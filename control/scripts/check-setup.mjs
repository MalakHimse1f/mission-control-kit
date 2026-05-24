#!/usr/bin/env node
/**
 * Mission Control + Superpowers setup check.
 * Run from project root: node docs/superpowers/control/scripts/check-setup.mjs
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const controlRoot = path.resolve(__dirname, '..');
const projectRoot = findProjectRoot(process.cwd());

const REQUIRED_SP_SKILLS = [
  { id: 'brainstorming', required: true, stage: 'braindump / refine' },
  { id: 'writing-plans', required: false, stage: 'plan' },
  { id: 'subagent-driven-development', required: false, stage: 'build' },
  { id: 'verification-before-completion', required: false, stage: 'validate' },
];

function findProjectRoot(start) {
  let dir = path.resolve(start);
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, 'docs', 'superpowers', 'control', 'INDEX.md'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(start);
}

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function findMissionControl(projectRoot) {
  const cursorCmd = path.join(projectRoot, '.cursor', 'commands', 'mc-braindump.md');
  const claudeSkill = path.join(projectRoot, '.claude', 'skills', 'mc-braindump', 'SKILL.md');
  if (exists(cursorCmd)) return { tool: 'Cursor', path: cursorCmd };
  if (exists(claudeSkill)) return { tool: 'Claude Code', path: claudeSkill };
  return null;
}

/** Bundled vendor copy from Mission Control install */
function findBundledSuperpowersSkill(projectRoot, skillId) {
  const paths = [
    path.join(projectRoot, '.claude', 'skills', 'vendor', 'superpowers', skillId, 'SKILL.md'),
    path.join(projectRoot, '.cursor', 'skills', 'vendor', 'superpowers', skillId, 'SKILL.md'),
  ];
  return paths.filter(exists);
}

/** Walk plugin cache for superpowers/skills/{name}/SKILL.md (optional plugin install) */
function findPluginSuperpowersSkill(skillId) {
  const caches = [
    path.join(os.homedir(), '.cursor', 'plugins', 'cache'),
    path.join(os.homedir(), '.claude', 'plugins', 'cache'),
  ];
  const hits = [];
  for (const cache of caches) {
    if (!exists(cache)) continue;
    walk(cache, 0, (file) => {
      const norm = file.replace(/\\/g, '/');
      if (norm.includes('/superpowers/') && norm.endsWith(`/skills/${skillId}/SKILL.md`)) {
        hits.push(file);
      }
    });
  }
  return hits;
}

function findSuperpowersSkill(projectRoot, skillId) {
  const bundled = findBundledSuperpowersSkill(projectRoot, skillId);
  if (bundled.length) return bundled;
  return findPluginSuperpowersSkill(skillId);
}

function walk(dir, depth, onFile) {
  if (depth > 8) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, depth + 1, onFile);
    else onFile(full);
  }
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}
function fail(msg) {
  console.log(`  ✗ ${msg}`);
}
function warn(msg) {
  console.log(`  ⚠ ${msg}`);
}

console.log('Mission Control setup check\n');
console.log(`Project root: ${projectRoot}`);
console.log(`Control root: ${controlRoot}\n`);

let passed = 0;
let failed = 0;
let warnings = 0;

if (exists(path.join(controlRoot, 'INDEX.md'))) {
  ok('Control plane found');
  passed++;
} else {
  fail('Control plane missing — copy control/ to docs/superpowers/control/');
  failed++;
}

const mc = findMissionControl(projectRoot);
if (mc) {
  ok(`Mission Control commands (${mc.tool})`);
  passed++;
} else {
  fail('Mission Control not installed — copy commands/ or claude-skills/ into this project');
  failed++;
}

console.log('\nSuperpowers (bundled on install, or via plugin):\n');

for (const skill of REQUIRED_SP_SKILLS) {
  const hits = findSuperpowersSkill(projectRoot, skill.id);
  if (hits.length > 0) {
    const source = hits[0].includes('/vendor/superpowers/') ? 'bundled' : 'plugin';
    ok(`${skill.id} (${skill.stage}, ${source})`);
    passed++;
  } else if (skill.required) {
    fail(`${skill.id} not found — run install/upgrade or install Superpowers plugin`);
    failed++;
  } else {
    warn(`${skill.id} not found — needed before ${skill.stage}`);
    warnings++;
  }
}

console.log('\n---');
if (failed === 0) {
  console.log(warnings ? 'Ready for /mc-feature (with warnings above for later stages).' : 'All checks passed. Run /mc-feature or /mc-start.');
  process.exit(0);
} else {
  console.log('Setup incomplete. Re-run install or see docs/superpowers/control/SUPERPOWERS-SETUP.md');
  process.exit(1);
}
