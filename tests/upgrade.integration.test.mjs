import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, before, after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readInstallStamp, shouldPreserveControlPath } from '../lib/mc-upgrade.mjs';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const kitVersion = JSON.parse(fs.readFileSync(path.join(kitRoot, 'kit-manifest.json'), 'utf8')).kitVersion;
let tmpProject;

function run(cmd, cwd = kitRoot) {
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

describe('safe upgrade integration (v5-native layout)', () => {
  before(() => {
    tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-upgrade-'));
    run(`bash "${path.join(kitRoot, 'install.sh')}" "${tmpProject}" both`);
  });

  after(() => {
    fs.rmSync(tmpProject, { recursive: true, force: true });
  });

  it('writes install stamp at the v5-native location on first install', () => {
    // v5.2.0: stamp lives at {projectRoot}/.mc/install.json, not under
    // the control plane and not at the legacy docs/superpowers path.
    const stamp = readInstallStamp(tmpProject);
    assert.ok(stamp, 'expected an install stamp to exist after install');
    assert.equal(stamp.kitVersion, kitVersion);
    // Defensive: the legacy v4 location must NOT have been created.
    assert.ok(
      !fs.existsSync(path.join(tmpProject, 'docs/superpowers/control/.mc/install.json')),
      'v5.2.0 install must not create the legacy docs/superpowers stamp',
    );
  });

  it('installs the v5 control plane at the project-root layout', () => {
    const v5Root = path.join(tmpProject, 'control', 'v5');
    assert.ok(fs.existsSync(v5Root), 'control/v5/ should exist after install');
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
    const v5Root = path.join(tmpProject, 'control', 'v5');
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

    // User content unchanged.
    assert.equal(fs.readFileSync(specPath, 'utf8'), userSpec);
    // Kit-managed routing docs still in place.
    assert.ok(
      fs.existsSync(path.join(v5Root, 'routing', 'ROUTING-MANIFEST.md')),
    );
  });

  it('--check exits 0 when up to date after install', () => {
    const out = run(`node "${path.join(kitRoot, 'scripts/mc-upgrade.mjs')}" "${tmpProject}" --check`);
    assert.ok(out.includes('UP_TO_DATE'), `expected UP_TO_DATE in: ${out}`);
  });

  it('dry-run does not change install-stamp content', () => {
    const stampPath = path.join(tmpProject, '.mc', 'install.json');
    const before = fs.readFileSync(stampPath, 'utf8');
    run(`node "${path.join(kitRoot, 'scripts/mc-upgrade.mjs')}" "${tmpProject}" --dry-run`);
    const after = fs.readFileSync(stampPath, 'utf8');
    assert.equal(before, after);
  });
});

describe('safe-upgrade feature dogfood paths', () => {
  it('kit feature safe-upgrade is preserved by rules', () => {
    assert.equal(shouldPreserveControlPath('features/safe-upgrade/spec.md'), true);
  });
});
