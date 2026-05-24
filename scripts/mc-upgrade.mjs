#!/usr/bin/env node
/**
 * Mission Control v4 — safe upgrade CLI.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  kitRootFromModule,
  readKitManifest,
  readInstallStamp,
  compareVersions,
  resolvePaths,
  runUpgrade,
} from '../lib/mc-upgrade.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultKitRoot = path.resolve(here, '..');
const args = process.argv.slice(2);

let projectRoot = process.cwd();
let install = false;
let check = false;
let dryRun = false;
let fetchRelease = false;
let target = 'both';
let kitRootArg = null;
let releaseRepo = null;
let releaseVersion = 'latest';

for (const arg of args) {
  if (arg === '--install') install = true;
  else if (arg === '--check') check = true;
  else if (arg === '--dry-run') dryRun = true;
  else if (arg === '--fetch') fetchRelease = true;
  else if (arg.startsWith('--target=')) target = arg.split('=')[1];
  else if (arg.startsWith('--kit-path=')) kitRootArg = arg.split('=')[1];
  else if (arg.startsWith('--repo=')) releaseRepo = arg.split('=')[1];
  else if (arg.startsWith('--version=')) releaseVersion = arg.split('=')[1];
  else if (!arg.startsWith('-')) projectRoot = path.resolve(arg);
}

const kitRootForCheck = kitRootArg ? path.resolve(kitRootArg) : defaultKitRoot;
const manifest = readKitManifest(
  fs.existsSync(path.join(kitRootForCheck, 'kit-manifest.json')) ? kitRootForCheck : defaultKitRoot,
);
const { controlRoot } = resolvePaths(projectRoot, kitRootForCheck);
const stamp = readInstallStamp(controlRoot);
const installed = stamp?.kitVersion ?? '0.0.0';
const latest = manifest.kitVersion;

if (check) {
  if (compareVersions(installed, latest) < 0) {
    console.log(`UPDATE_AVAILABLE ${installed} -> ${latest}`);
    process.exit(1);
  }
  console.log(`UP_TO_DATE ${installed}`);
  process.exit(0);
}

const result = await runUpgrade({
  projectRoot,
  kitRootArg: kitRootArg ?? (fetchRelease ? null : defaultKitRoot),
  fetchRelease,
  releaseRepo,
  releaseVersion,
  target,
  dryRun,
  install,
});

if (result.status === 'up-to-date') {
  console.log(`Mission Control already at ${result.toVersion}`);
  process.exit(0);
}

console.log(
  `${dryRun ? '[dry-run] ' : ''}${result.status}: ${result.fromVersion ?? 'none'} → ${result.toVersion}`,
);
console.log(`  synced: ${result.copiedControl.length} control files`);
console.log(`  preserved: ${result.skippedControl.length} user paths`);
if (result.migrations.length) console.log(`  migrations: ${result.migrations.join(', ')}`);
if (result.backupDir) console.log(`  backup: ${result.backupDir}`);

if (!dryRun) {
  if (target === 'claude' || target === 'both') {
    const bundle = path.join(defaultKitRoot, 'scripts/bundle-vendor-skills.sh');
    const activeKit = kitRootArg ? path.resolve(kitRootArg) : defaultKitRoot;
    const bundleScript = path.join(activeKit, 'scripts/bundle-vendor-skills.sh');
    const script = fs.existsSync(bundleScript) ? bundleScript : bundle;
    if (fs.existsSync(script)) {
      try {
        execSync(`bash "${script}" "${projectRoot}" project`, { stdio: 'inherit' });
      } catch {
        console.warn('WARN: vendor bundle step failed — run mc-setup-skills later.');
      }
    }
  }
  if (fs.existsSync(path.join(controlRoot, 'scripts/generate-dashboard.mjs'))) {
    execSync('node docs/superpowers/control/scripts/generate-dashboard.mjs', {
      cwd: projectRoot,
      stdio: 'inherit',
    });
  }
}

process.exit(0);
