#!/usr/bin/env node
/**
 * Mission Control v5 — portable vendor skill bundler.
 *
 * Clones / updates pinned vendor skill repos into the kit and/or project,
 * matching the semantics of the previous `bundle-vendor-skills.sh` script
 * but without any bash / rsync dependency. Works identically on macOS,
 * Linux, and Windows — `git` is the only external requirement.
 *
 * Usage:
 *   node bundle-vendor-skills.mjs [projectRoot] [target]
 *
 *   target: kit | project | both   (default: project)
 *
 * The kit's `vendor/manifest.json` defines each bundle (repo, ref,
 * optional `sourceSubpath`, install/project destination paths).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_ROOT = process.argv[2] ? path.resolve(process.argv[2]) : '';
const TARGET = (process.argv[3] || 'project').toLowerCase();

const VALID_TARGETS = new Set(['kit', 'project', 'both']);
if (!VALID_TARGETS.has(TARGET)) {
  console.error(`bundle-vendor-skills: invalid target "${TARGET}" (expected kit | project | both)`);
  process.exit(2);
}

const MANIFEST_PATH = path.join(KIT_ROOT, 'vendor', 'manifest.json');
if (!fs.existsSync(MANIFEST_PATH)) {
  console.error(`bundle-vendor-skills: missing ${MANIFEST_PATH}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

function runGit(args, opts = {}) {
  const res = spawnSync('git', args, { stdio: 'inherit', ...opts });
  if (res.status !== 0) {
    if (res.error) {
      throw new Error(`git ${args.join(' ')} failed: ${res.error.message}`);
    }
    throw new Error(`git ${args.join(' ')} failed (exit ${res.status})`);
  }
}

function tryGit(args, opts = {}) {
  const res = spawnSync('git', args, { stdio: 'inherit', ...opts });
  return res.status === 0;
}

function rmrf(target) {
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Replace the contents of `dest` with the contents of `src`.
 * Semantically equivalent to `rsync -a --delete "$src/" "$dest/"`.
 */
function syncDirContents(src, dest) {
  rmrf(dest);
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    fs.cpSync(s, d, { recursive: true });
  }
}

function hasNonGitContent(p) {
  if (!fs.existsSync(p)) return false;
  try {
    return fs.readdirSync(p).filter((e) => e !== '.git').length > 0;
  } catch {
    return false;
  }
}

function cloneOrUpdate(id, repo, ref, dest) {
  if (fs.existsSync(path.join(dest, '.git'))) {
    console.log(`Updating ${id} at ${dest}`);
    if (!tryGit(['-C', dest, 'fetch', '--depth', '1', 'origin', ref])) {
      tryGit(['-C', dest, 'fetch', 'origin']);
    }
    if (!tryGit(['-C', dest, 'checkout', ref])) {
      tryGit(['-C', dest, 'checkout', `origin/${ref}`]);
    }
    tryGit(['-C', dest, 'pull', '--ff-only']);
    return;
  }

  console.log(`Cloning ${id} from ${repo} (${ref}) -> ${dest}`);
  ensureDir(path.dirname(dest));
  if (!tryGit(['clone', '--depth', '1', '--branch', ref, repo, dest])) {
    runGit(['clone', '--depth', '1', repo, dest]);
  }
}

function extractSubpath(srcRoot, subpath, dest) {
  const src = path.join(srcRoot, subpath);
  if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
    throw new Error(`missing subpath ${subpath} in ${srcRoot}`);
  }
  syncDirContents(src, dest);
}

/**
 * Mirror a project vendor bundle from `.claude/skills/vendor/<id>` into
 * `.cursor/skills/vendor/<id>` so Cursor sees the same skills as Claude
 * Code. Matches the kit-skill mirror in lib/mc-upgrade.mjs.
 *
 * (The previous bash version used a buggy `${var/.claude\/.cursor}`
 * parameter expansion that silently did nothing — this restores the
 * documented behavior.)
 */
function mirrorVendorToCursor(projectDest) {
  const norm = projectDest.replace(/\\/g, '/');
  const markerIdx = norm.indexOf('/.claude/skills/vendor/');
  if (markerIdx === -1) return;
  const before = norm.slice(0, markerIdx);
  const after = norm.slice(markerIdx + '/.claude/skills/vendor/'.length);
  const cursorDest = path.join(before, '.cursor', 'skills', 'vendor', after);
  ensureDir(path.dirname(cursorDest));
  syncDirContents(projectDest, cursorDest);
  console.log(`Mirrored vendor bundle -> ${cursorDest}`);
}

function installBundle(bundle) {
  const { id, repo, ref, installPath, projectSkillsPath, sourceSubpath } = bundle;
  const kitDest = path.join(KIT_ROOT, installPath);
  const kitClone = path.join(KIT_ROOT, 'vendor', `.cache-${id}`);

  if (sourceSubpath) {
    if (TARGET === 'kit' || TARGET === 'both') {
      cloneOrUpdate(id, repo, ref, kitClone);
      extractSubpath(kitClone, sourceSubpath, kitDest);
    }
    if (PROJECT_ROOT && (TARGET === 'project' || TARGET === 'both')) {
      const projectDest = path.join(PROJECT_ROOT, projectSkillsPath);
      ensureDir(path.dirname(projectDest));
      if (hasNonGitContent(kitDest)) {
        syncDirContents(kitDest, projectDest);
        console.log(`Installed ${id} -> ${projectDest} (from kit cache)`);
      } else {
        cloneOrUpdate(id, repo, ref, kitClone);
        extractSubpath(kitClone, sourceSubpath, projectDest);
        console.log(`Installed ${id} -> ${projectDest} (direct clone)`);
      }
      mirrorVendorToCursor(projectDest);
    }
    return;
  }

  if (TARGET === 'kit' || TARGET === 'both') {
    cloneOrUpdate(id, repo, ref, kitDest);
  }
  if (PROJECT_ROOT && (TARGET === 'project' || TARGET === 'both')) {
    const projectDest = path.join(PROJECT_ROOT, projectSkillsPath);
    ensureDir(path.dirname(projectDest));
    if (hasNonGitContent(kitDest)) {
      syncDirContents(kitDest, projectDest);
      console.log(`Installed ${id} -> ${projectDest} (from kit cache)`);
    } else {
      cloneOrUpdate(id, repo, ref, projectDest);
      console.log(`Installed ${id} -> ${projectDest} (direct clone)`);
    }
    mirrorVendorToCursor(projectDest);
  }
}

let failures = 0;
for (const bundle of manifest.bundles) {
  try {
    installBundle(bundle);
  } catch (err) {
    failures += 1;
    console.error(`bundle-vendor-skills: ${bundle.id} failed — ${err.message}`);
  }
}

if (PROJECT_ROOT) {
  const checkScript = path.join(KIT_ROOT, 'scripts', 'check-vendor-skills.mjs');
  if (fs.existsSync(checkScript)) {
    spawnSync(process.execPath, [checkScript, PROJECT_ROOT], { stdio: 'inherit' });
  }
}

console.log('Vendor skill bundle step complete.');
process.exit(failures > 0 ? 1 : 0);
