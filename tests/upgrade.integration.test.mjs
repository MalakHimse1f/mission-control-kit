import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, before, after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readInstallStamp, shouldPreserveControlPath } from '../lib/mc-upgrade.mjs';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let tmpProject;

function run(cmd, cwd = kitRoot) {
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

describe('safe upgrade integration', () => {
  before(() => {
    tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-upgrade-'));
    run(`bash "${path.join(kitRoot, 'install.sh')}" "${tmpProject}" both`);
  });

  after(() => {
    fs.rmSync(tmpProject, { recursive: true, force: true });
  });

  it('writes install stamp on first install', () => {
    const stamp = readInstallStamp(path.join(tmpProject, 'docs/superpowers/control'));
    assert.ok(stamp);
    assert.equal(stamp.kitVersion, '4.5.0');
  });

  it('preserves user feature spec across upgrade', () => {
    const control = path.join(tmpProject, 'docs/superpowers/control');
    const featureDir = path.join(control, 'features', 'user-feat');
    fs.mkdirSync(path.join(featureDir, 'journal'), { recursive: true });
    const specPath = path.join(featureDir, 'spec.md');
    const userSpec = '# User Feature\n\nDo not overwrite this spec.\n';
    fs.writeFileSync(specPath, userSpec);
    fs.writeFileSync(
      path.join(featureDir, 'status.json'),
      JSON.stringify({ feature: 'user-feat', specStatus: 'approved' }, null, 2),
    );

    run(`node "${path.join(kitRoot, 'scripts/mc-upgrade.mjs')}" "${tmpProject}"`);

    assert.equal(fs.readFileSync(specPath, 'utf8'), userSpec);
    const router = fs.readFileSync(path.join(control, 'ROUTER.md'), 'utf8');
    assert.ok(router.includes('mc-feature'));
  });

  it('--check exits 0 when up to date after upgrade', () => {
    const out = run(`node "${path.join(kitRoot, 'scripts/mc-upgrade.mjs')}" "${tmpProject}" --check`);
    assert.ok(out.includes('UP_TO_DATE'));
  });

  it('dry-run does not change install stamp mtime content', () => {
    const stampPath = path.join(tmpProject, 'docs/superpowers/control/.mc/install.json');
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
