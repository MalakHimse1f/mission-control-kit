import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  shouldPreserveControlPath,
  compareVersions,
  parseVersion,
  listControlSyncPlan,
  CONTROL_PRESERVE_EXACT,
} from '../lib/mc-upgrade.mjs';

describe('shouldPreserveControlPath', () => {
  it('preserves user feature folders', () => {
    assert.equal(shouldPreserveControlPath('features/safe-upgrade/spec.md'), true);
    assert.equal(shouldPreserveControlPath('features/safe-upgrade/journal/001-prd.md'), true);
  });

  it('allows kit template sync under features/_template', () => {
    assert.equal(shouldPreserveControlPath('features/_template/spec.md'), false);
  });

  it('preserves project and user tech-stack slugs', () => {
    assert.equal(shouldPreserveControlPath('project/PROJECT.md'), true);
    assert.equal(shouldPreserveControlPath('tech-stack/next-app/spec.md'), true);
  });

  it('allows kit tech-stack docs sync', () => {
    assert.equal(shouldPreserveControlPath('tech-stack/README.md'), false);
    assert.equal(shouldPreserveControlPath('tech-stack/LAYOUT-TARGETS.md'), false);
    assert.equal(shouldPreserveControlPath('tech-stack/_template/spec.md'), false);
  });

  it('preserves exact user state files', () => {
    for (const p of CONTROL_PRESERVE_EXACT) {
      assert.equal(shouldPreserveControlPath(p), true, p);
    }
  });

  it('preserves .mc user data', () => {
    assert.equal(shouldPreserveControlPath('.mc/install.json'), true);
    assert.equal(shouldPreserveControlPath('.mc/backups/2026/foo.json'), true);
  });

  it('allows kit doc sync at control root', () => {
    assert.equal(shouldPreserveControlPath('ROUTER.md'), false);
    assert.equal(shouldPreserveControlPath('scripts/dashboard-template.mjs'), false);
  });

  it('preserves custom overlay directory', () => {
    assert.equal(shouldPreserveControlPath('custom/ROUTER.patch.md'), true);
  });
});

describe('compareVersions', () => {
  it('detects upgrade available', () => {
    assert.equal(compareVersions('4.0.0', '4.1.0'), -1);
    assert.equal(compareVersions('4.1.0', '4.1.0'), 0);
    assert.equal(compareVersions('4.2.0', '4.1.0'), 1);
  });

  it('parses semver tuples', () => {
    assert.deepEqual(parseVersion('4.1.0'), [4, 1, 0]);
  });
});

describe('listControlSyncPlan', () => {
  it('skips preserved paths in sync plan', () => {
    const plan = listControlSyncPlan([
      'ROUTER.md',
      'features/safe-upgrade/spec.md',
      'features/_template/spec.md',
      'state.json',
    ]);
    assert.deepEqual(plan.sync, ['ROUTER.md', 'features/_template/spec.md']);
    assert.deepEqual(plan.preserve, ['features/safe-upgrade/spec.md', 'state.json']);
  });
});
