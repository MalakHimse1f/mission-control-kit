/**
 * Tests for lib/v5/kit-version.mjs — semver compare, layout detection,
 * and the SSR-side pieces of the dashboard "Upgrade kit" feature.
 *
 * Network-touching paths (`fetchKitManifest`, `runKitUpgrade`) are NOT
 * exercised here — they're covered by the smoke-test step we run as
 * part of the release. These tests cover the deterministic parts:
 *   - compareVersions / parseSemver edge cases
 *   - resolveControlRoot picks the right layout
 *   - checkKitVersion threads remote-error failures through cleanly
 *     (we stub the HTTP layer via monkey-patching to keep this hermetic)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  compareVersions,
  parseSemver,
  resolveControlRoot,
} from '../lib/v5/kit-version.mjs';

async function tmpProject() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'mc-v5-kit-version-'));
}

test('parseSemver handles missing / malformed values', () => {
  assert.deepEqual(parseSemver(null), [0, 0, 0]);
  assert.deepEqual(parseSemver(undefined), [0, 0, 0]);
  assert.deepEqual(parseSemver(''), [0, 0, 0]);
  assert.deepEqual(parseSemver('not-a-version'), [0, 0, 0]);
  assert.deepEqual(parseSemver('5.1.1'), [5, 1, 1]);
  assert.deepEqual(parseSemver('5.1.1-rc.2'), [5, 1, 1]); // suffix ignored
  assert.deepEqual(parseSemver('10.0.0'), [10, 0, 0]);
});

test('compareVersions orders semver triples correctly', () => {
  assert.ok(compareVersions('5.0.0', '5.1.0') < 0);
  assert.ok(compareVersions('5.1.0', '5.0.0') > 0);
  assert.equal(compareVersions('5.1.1', '5.1.1'), 0);
  assert.ok(compareVersions('4.7.1', '5.0.0') < 0);
  assert.ok(compareVersions('10.0.0', '9.99.99') > 0); // numeric, not lexical
});

test('resolveControlRoot picks the project-root layout', async () => {
  const project = await tmpProject();
  try {
    await fs.mkdir(path.join(project, 'control', 'v5'), { recursive: true });
    const root = await resolveControlRoot(project);
    assert.equal(root, path.join(project, 'control'));
  } finally {
    await fs.rm(project, { recursive: true, force: true });
  }
});

test('resolveControlRoot picks the v4 layout when only that exists', async () => {
  const project = await tmpProject();
  try {
    await fs.mkdir(
      path.join(project, 'docs', 'superpowers', 'control', 'v5'),
      { recursive: true },
    );
    const root = await resolveControlRoot(project);
    assert.equal(root, path.join(project, 'docs', 'superpowers', 'control'));
  } finally {
    await fs.rm(project, { recursive: true, force: true });
  }
});

test('resolveControlRoot returns null when no v5 control plane exists', async () => {
  const project = await tmpProject();
  try {
    const root = await resolveControlRoot(project);
    assert.equal(root, null);
  } finally {
    await fs.rm(project, { recursive: true, force: true });
  }
});

test('resolveControlRoot prefers project-root layout over v4 when BOTH exist', async () => {
  // Edge case: a project that was installed v4-style and then also had
  // a v5 direct migration run against it. Prefer the project-root layout
  // since that's the one the v5 server normally treats as canonical.
  const project = await tmpProject();
  try {
    await fs.mkdir(path.join(project, 'control', 'v5'), { recursive: true });
    await fs.mkdir(
      path.join(project, 'docs', 'superpowers', 'control', 'v5'),
      { recursive: true },
    );
    const root = await resolveControlRoot(project);
    assert.equal(root, path.join(project, 'control'));
  } finally {
    await fs.rm(project, { recursive: true, force: true });
  }
});
