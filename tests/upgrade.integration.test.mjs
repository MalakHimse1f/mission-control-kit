import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, before, after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readInstallStamp, shouldPreserveControlPath } from '../lib/mc-upgrade.mjs';
import { resolveLayout } from '../lib/layout.mjs';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const kitFolder = path.basename(kitRoot);
const kitVersion = JSON.parse(fs.readFileSync(path.join(kitRoot, 'kit-manifest.json'), 'utf8')).kitVersion;
const isWindows = process.platform === 'win32';

function run(cmd, cwd = kitRoot) {
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

/**
 * Run the kit's installer for the current platform. On Windows the
 * canonical entry point is `install.ps1` (the bash script can't be
 * relied on because Windows ships `bash` -> WSL, not Git Bash). On
 * macOS / Linux we still invoke `install.sh`.
 */
function runInstaller(projectRoot, target = 'both') {
  if (isWindows) {
    const ps1 = path.join(kitRoot, 'install.ps1');
    return run(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1}" -ProjectRoot "${projectRoot}" -Target ${target}`,
    );
  }
  return run(`bash "${path.join(kitRoot, 'install.sh')}" "${projectRoot}" ${target}`);
}

/**
 * Fresh install scenario — no pre-existing Mission Control data on disk.
 * The kit-nested layout (v5.3.0+) is the new default: everything lives
 * under `{projectRoot}/{kitFolder}/`.
 */
describe('safe upgrade integration (v5.3 kit-nested layout, fresh install)', () => {
  let tmpProject;
  let layout;

  before(() => {
    tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-fresh-'));
    runInstaller(tmpProject, 'both');
    layout = resolveLayout(tmpProject);
  });

  after(() => {
    fs.rmSync(tmpProject, { recursive: true, force: true });
  });

  it('selects the kit-nested layout for fresh installs', () => {
    assert.equal(layout.kind, 'kit-nested');
    assert.equal(
      layout.controlRoot,
      path.join(tmpProject, kitFolder, 'control'),
    );
  });

  it('writes the install stamp inside the kit folder', () => {
    const stamp = readInstallStamp(tmpProject);
    assert.ok(stamp, 'expected an install stamp to exist after install');
    assert.equal(stamp.kitVersion, kitVersion);
    assert.equal(stamp.layout, 'kit-nested');
    assert.ok(
      fs.existsSync(path.join(tmpProject, kitFolder, '.mc', 'install.json')),
      'kit-nested install stamp should exist',
    );
    // Defensive: neither legacy stamp location should have been created.
    assert.ok(
      !fs.existsSync(path.join(tmpProject, '.mc', 'install.json')),
      'fresh kit-nested install must not create the root-layout stamp',
    );
    assert.ok(
      !fs.existsSync(path.join(tmpProject, 'docs/superpowers/control/.mc/install.json')),
      'fresh kit-nested install must not create the legacy docs/superpowers stamp',
    );
  });

  it('installs the v5 control plane inside the kit folder', () => {
    const v5Root = path.join(layout.controlRoot, 'v5');
    assert.ok(fs.existsSync(v5Root), `${v5Root} should exist after install`);
    assert.ok(
      fs.existsSync(path.join(v5Root, 'routing', 'ROUTING-MANIFEST.md')),
      'routing docs should be seeded by the 5.0.0-v5-refactor migration',
    );
    assert.ok(
      fs.existsSync(path.join(v5Root, '_diagram-assets', 'diagram.css')),
      'diagram assets should be present (5.1.0-expanded-primitives)',
    );
  });

  it('preserves user feature folder across upgrade', () => {
    const v5Root = path.join(layout.controlRoot, 'v5');
    const featureDir = path.join(v5Root, 'features', 'user-feat');
    fs.mkdirSync(featureDir, { recursive: true });
    const specPath = path.join(featureDir, 'spec.md');
    const userSpec = '# User Feature\n\nDo not overwrite this spec.\n';
    fs.writeFileSync(specPath, userSpec);
    fs.writeFileSync(
      path.join(featureDir, 'status.json'),
      JSON.stringify({ slug: 'user-feat', stage: 'needs-input' }, null, 2),
    );

    run(`node "${path.join(kitRoot, 'scripts/mc-upgrade.mjs')}" "${tmpProject}"`);

    assert.equal(fs.readFileSync(specPath, 'utf8'), userSpec);
    assert.ok(
      fs.existsSync(path.join(v5Root, 'routing', 'ROUTING-MANIFEST.md')),
    );
  });

  it('--check exits 0 when up to date after install', () => {
    const out = run(`node "${path.join(kitRoot, 'scripts/mc-upgrade.mjs')}" "${tmpProject}" --check`);
    assert.ok(out.includes('UP_TO_DATE'), `expected UP_TO_DATE in: ${out}`);
  });

  it('dry-run does not change install-stamp content', () => {
    const before = fs.readFileSync(layout.installStampPath, 'utf8');
    run(`node "${path.join(kitRoot, 'scripts/mc-upgrade.mjs')}" "${tmpProject}" --dry-run`);
    const after = fs.readFileSync(layout.installStampPath, 'utf8');
    assert.equal(before, after);
  });
});

/**
 * Existing-install scenario — a v5.2.0 project where user data already
 * lives at the root layout. Upgrades MUST NOT relocate it. The v5.3.0
 * kit-nested layout only applies to fresh installs.
 *
 * Setup: pre-seed a v5.2.0 stamp AND a v5 control plane skeleton at the
 * root layout so the resolver picks "root" and the upgrade exercises the
 * in-place upgrade code path (rather than the fresh-install code path).
 */
describe('safe upgrade integration (v5.2 root layout, existing install)', () => {
  let tmpProject;

  before(() => {
    tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-existing-'));
    // Seed a v5.2.0-style stamp + control plane at the root layout BEFORE
    // install runs so the upgrade engine treats this as an in-place
    // upgrade and the layout resolver picks "root" rather than the new
    // kit-nested default.
    fs.mkdirSync(path.join(tmpProject, 'control', 'v5'), { recursive: true });
    fs.mkdirSync(path.join(tmpProject, '.mc'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpProject, '.mc', 'install.json'),
      JSON.stringify(
        {
          kitVersion: '5.2.0',
          schemaVersion: 1,
          installedAt: '2026-01-01T00:00:00.000Z',
          kitPath: 'mission-control-kit',
          migrationsApplied: [],
          target: 'both',
        },
        null,
        2,
      ),
    );
    // Add a user feature so we can verify preservation across upgrade.
    const featureDir = path.join(tmpProject, 'control', 'v5', 'features', 'pre-existing');
    fs.mkdirSync(featureDir, { recursive: true });
    fs.writeFileSync(path.join(featureDir, 'spec.md'), '# Pre-existing\n');

    runInstaller(tmpProject, 'both');
  });

  after(() => {
    fs.rmSync(tmpProject, { recursive: true, force: true });
  });

  it('keeps the install stamp at the root layout', () => {
    const layout = resolveLayout(tmpProject);
    assert.equal(layout.kind, 'root', 'existing v5.2 install must stay on the root layout');
    assert.ok(fs.existsSync(path.join(tmpProject, '.mc', 'install.json')));
    assert.ok(
      !fs.existsSync(path.join(tmpProject, kitFolder, '.mc', 'install.json')),
      'upgrade must not relocate the stamp into the kit folder',
    );
  });

  it('does not duplicate the control plane into the kit folder', () => {
    assert.ok(
      fs.existsSync(path.join(tmpProject, 'control', 'v5')),
      'control plane stays at the project root',
    );
    assert.ok(
      !fs.existsSync(path.join(tmpProject, kitFolder, 'control', 'v5')),
      'upgrade must not duplicate the control plane into the kit folder',
    );
  });

  it('preserves the pre-existing user feature in place', () => {
    assert.equal(
      fs.readFileSync(
        path.join(tmpProject, 'control', 'v5', 'features', 'pre-existing', 'spec.md'),
        'utf8',
      ),
      '# Pre-existing\n',
    );
  });
});

describe('safe-upgrade feature dogfood paths', () => {
  it('kit feature safe-upgrade is preserved by rules', () => {
    assert.equal(shouldPreserveControlPath('features/safe-upgrade/spec.md'), true);
  });
});
