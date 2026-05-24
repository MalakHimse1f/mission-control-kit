#!/usr/bin/env node
/**
 * Build a publishable Mission Control Kit tarball for GitHub Releases.
 * Output: dist/mission-control-kit-{version}.tar.gz
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(kitRoot, 'kit-manifest.json'), 'utf8'));
const version = manifest.kitVersion;
const folderName = manifest.kitFolder ?? 'mission-control-kit';
const outDir = path.join(kitRoot, 'dist');
const archiveName = `${folderName}-${version}.tar.gz`;
const archivePath = path.join(outDir, archiveName);

/** Paths relative to kit root — excluded from release bundle */
export const RELEASE_EXCLUDE_PREFIXES = [
  'vendor/.cache-',
  'vendor/superpowers',
  'vendor/startup-skill',
  'vendor/designer-skills',
  'vendor/prd-generator',
  'sample-project/.claude',
  'sample-project/.cursor',
  'sample-project/docs/superpowers/control/.mc/backups',
  'sample-project/docs/superpowers/control/.mc/cache',
  'dist',
  'node_modules',
];

export function shouldExcludeReleasePath(relPath) {
  const norm = relPath.replace(/\\/g, '/');
  if (norm.startsWith('.git/') || norm === '.git') return true;
  return RELEASE_EXCLUDE_PREFIXES.some((prefix) => {
    if (norm === prefix) return true;
    if (prefix.endsWith('-')) return norm.startsWith(prefix);
    return norm.startsWith(`${prefix}/`);
  });
}

export function listReleaseFiles(rootDir, prefix = '') {
  const out = [];
  if (!fs.existsSync(rootDir)) return out;
  for (const name of fs.readdirSync(rootDir)) {
    if (name === '.git') continue;
    const rel = prefix ? `${prefix}/${name}` : name;
    if (shouldExcludeReleasePath(rel)) continue;
    const full = path.join(rootDir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...listReleaseFiles(full, rel));
    else out.push(rel);
  }
  return out;
}

function copyReleaseTree(srcRoot, destRoot) {
  const files = listReleaseFiles(srcRoot);
  for (const rel of files) {
    const src = path.join(srcRoot, rel);
    const dest = path.join(destRoot, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
  return files.length;
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const stagingParent = fs.mkdtempSync(path.join(outDir, '.staging-'));
  const stagingKit = path.join(stagingParent, folderName);

  if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath);

  copyReleaseTree(kitRoot, stagingKit);
  const count = listReleaseFiles(stagingKit).length;

  execSync(`tar -czf "${archivePath}" -C "${stagingParent}" "${folderName}"`, {
    stdio: 'inherit',
  });

  fs.rmSync(stagingParent, { recursive: true, force: true });

  const stat = fs.statSync(archivePath);
  console.log(`Built ${archivePath}`);
  console.log(`  version: ${version}`);
  console.log(`  files: ${count}`);
  console.log(`  size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
  console.log('');
  console.log('Publish:');
  console.log(`  git tag mc-kit-v${version}`);
  console.log(`  git push origin mc-kit-v${version}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
