#!/usr/bin/env node
/**
 * Verify required vendor skill bundles are present for Mission Control v4.
 *
 * Accepts either:
 *   1. A vendored copy at `<projectRoot>/<bundle.projectSkillsPath>`, or
 *   2. A plugin install at one of the well-known marketplace cache paths
 *      (Claude Code: `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/skills/`;
 *       Cursor:      `~/.cursor/plugins/cache/<marketplace>/<plugin>/<version>/skills/`).
 *
 * The plugin fallback lets users who already run, e.g., the official
 * `superpowers` plugin skip the project-local vendor copy without
 * tripping the BUILD-GATES.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(process.argv[2] || process.cwd());
const workflow = process.argv[3] || 'all';

const here = path.dirname(fileURLToPath(import.meta.url));
const manifestCandidates = [
  path.join(projectRoot, 'mission-control-kit', 'vendor', 'manifest.json'),
  path.join(projectRoot, 'docs', 'superpowers', 'control', 'vendor', 'manifest.json'),
  path.join(here, '..', 'vendor', 'manifest.json'),
  path.join(here, '..', '..', 'vendor', 'manifest.json'),
];

const manifestPath = manifestCandidates.find((p) => fs.existsSync(p));
if (!manifestPath) {
  console.error('MISSING_VENDOR_MANIFEST');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function existsDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function skillPresent(skillsPath, skillId, bundleId) {
  if (fs.existsSync(path.join(skillsPath, skillId, 'SKILL.md'))) return true;
  if (skillId === bundleId && fs.existsSync(path.join(skillsPath, 'SKILL.md'))) return true;
  if (existsDir(path.join(skillsPath, skillId))) return true;
  return false;
}

function safeReaddir(p) {
  try {
    return fs.readdirSync(p);
  } catch {
    return [];
  }
}

/**
 * Look for an installed Claude Code / Cursor plugin whose skills directory
 * satisfies the bundle's `requiredSkills`. Returns the skills directory
 * path on match, or null.
 *
 * Expected layout (observed on both Claude Code and Cursor):
 *   <home>/.{claude,cursor}/plugins/cache/<marketplace>/<plugin>/<version>/skills/<skill>/SKILL.md
 *
 * We probe `<plugin> == bundle.id` first (most precise), then fall back to
 * scanning every plugin under each marketplace (covers cases where the
 * marketplace renames the plugin — e.g. `superpowers@claude-plugins-official`).
 */
function findPluginInstall(bundle) {
  if (!bundle.requiredSkills?.length) return null;
  const home = os.homedir();
  if (!home) return null;

  const cacheRoots = [
    path.join(home, '.claude', 'plugins', 'cache'),
    path.join(home, '.cursor', 'plugins', 'cache'),
  ];

  const allRequired = (skillsDir) =>
    bundle.requiredSkills.every((s) => skillPresent(skillsDir, s, bundle.id));

  for (const cacheRoot of cacheRoots) {
    if (!existsDir(cacheRoot)) continue;
    for (const marketplace of safeReaddir(cacheRoot)) {
      const marketplaceDir = path.join(cacheRoot, marketplace);
      if (!existsDir(marketplaceDir)) continue;

      const pluginCandidates = [bundle.id, ...safeReaddir(marketplaceDir)];
      const seenPlugin = new Set();
      for (const plugin of pluginCandidates) {
        if (seenPlugin.has(plugin)) continue;
        seenPlugin.add(plugin);
        const pluginDir = path.join(marketplaceDir, plugin);
        if (!existsDir(pluginDir)) continue;
        for (const version of safeReaddir(pluginDir)) {
          const skillsDir = path.join(pluginDir, version, 'skills');
          if (!existsDir(skillsDir)) continue;
          if (allRequired(skillsDir)) return skillsDir;
        }
      }
    }
  }
  return null;
}

function bundleOk(bundle) {
  const projectPath = path.join(projectRoot, bundle.projectSkillsPath);
  const haveDir = existsDir(projectPath);

  if (haveDir) {
    if (bundle.requiredSkills?.length) {
      const allPresent = bundle.requiredSkills.every((s) =>
        skillPresent(projectPath, s, bundle.id),
      );
      if (allPresent) return { ok: true, source: 'vendor', path: projectPath };
    } else {
      const entries = fs.readdirSync(projectPath).filter((e) => !e.startsWith('.'));
      if (entries.length > 0) return { ok: true, source: 'vendor', path: projectPath };
    }
  }

  const pluginSkills = findPluginInstall(bundle);
  if (pluginSkills) {
    return { ok: true, source: 'plugin', path: pluginSkills };
  }

  if (!haveDir) {
    return {
      ok: false,
      reason: `missing directory ${bundle.projectSkillsPath} (and no plugin install detected)`,
    };
  }
  if (bundle.requiredSkills?.length) {
    const missingSkill = bundle.requiredSkills.find(
      (s) => !skillPresent(projectPath, s, bundle.id),
    );
    return {
      ok: false,
      reason: `missing skill ${missingSkill} in ${bundle.projectSkillsPath} (and no plugin install detected)`,
    };
  }
  return { ok: false, reason: 'empty vendor directory (and no plugin install detected)' };
}

const bundles = manifest.bundles.filter((b) => {
  if (workflow === 'all') return true;
  return (b.requiredFor || []).includes(workflow);
});

const missing = [];
const satisfied = [];
for (const bundle of bundles) {
  const result = bundleOk(bundle);
  if (!result.ok) missing.push({ id: bundle.id, reason: result.reason });
  else satisfied.push({ id: bundle.id, source: result.source, path: result.path });
}

if (missing.length) {
  console.error('MISSING_VENDOR_SKILLS');
  for (const m of missing) console.error(`- ${m.id}: ${m.reason}`);
  process.exit(1);
}

console.log('VENDOR_SKILLS_OK');
for (const b of satisfied) {
  console.log(`- ${b.id} (${b.source}${b.source === 'plugin' ? ` @ ${b.path}` : ''})`);
}
