#!/usr/bin/env node
/**
 * Verify required vendor skill bundles are present for Mission Control v4.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(process.argv[2] || process.cwd());
const workflow = process.argv[3] || 'all';

const here = path.dirname(fileURLToPath(import.meta.url));
const manifestCandidates = [
  path.join(projectRoot, 'mission-control-kit-v4', 'vendor', 'manifest.json'),
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

function bundleOk(bundle) {
  const projectPath = path.join(projectRoot, bundle.projectSkillsPath);
  if (!existsDir(projectPath)) {
    return { ok: false, reason: `missing directory ${bundle.projectSkillsPath}` };
  }
  const entries = fs.readdirSync(projectPath).filter((e) => !e.startsWith('.'));
  if (entries.length === 0) {
    return { ok: false, reason: 'empty vendor directory' };
  }
  return { ok: true };
}

const bundles = manifest.bundles.filter((b) => {
  if (workflow === 'all') return true;
  return (b.requiredFor || []).includes(workflow);
});

const missing = [];
for (const bundle of bundles) {
  const result = bundleOk(bundle);
  if (!result.ok) missing.push({ id: bundle.id, reason: result.reason });
}

if (missing.length) {
  console.error('MISSING_VENDOR_SKILLS');
  for (const m of missing) console.error(`- ${m.id}: ${m.reason}`);
  process.exit(1);
}

console.log('VENDOR_SKILLS_OK');
for (const bundle of bundles) console.log(`- ${bundle.id}`);
