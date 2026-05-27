#!/usr/bin/env node
/**
 * Mission Control v4 — safe upgrade CLI.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  kitRootFromModule,
  readKitManifest,
  readInstallStamp,
  compareVersions,
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
// v5.2.0: install stamp lives at the project root, not under the control plane.
const stamp = readInstallStamp(projectRoot);
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
    const activeKit = kitRootArg ? path.resolve(kitRootArg) : defaultKitRoot;
    const candidates = [
      path.join(activeKit, 'scripts/bundle-vendor-skills.mjs'),
      path.join(defaultKitRoot, 'scripts/bundle-vendor-skills.mjs'),
    ];
    const script = candidates.find((p) => fs.existsSync(p));
    if (script) {
      const result = spawnSync(
        process.execPath,
        [script, projectRoot, 'project'],
        { stdio: 'inherit' },
      );
      if (result.error || result.status !== 0) {
        const exit = result.status ?? 'spawn-failed';
        console.warn(`WARN: vendor bundle step failed (exit ${exit}).`);
        if (result.error) console.warn(`  ${result.error.message}`);
        console.warn(
          `  Retry: node "${script}" "${projectRoot}" project`,
        );
        console.warn(
          '  Or dispatch the mc-setup-skills subagent in chat.',
        );
      }
    }
  }
  // v5.2.0+: the v4 static dashboard generator is gone. The v5 dashboard
  // is served live from `mission-control-kit/control/scripts/v5/dashboard-server.mjs`;
  // there's no post-upgrade artifact to regenerate.
}

process.exit(0);
