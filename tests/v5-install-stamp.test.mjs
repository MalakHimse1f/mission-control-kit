/**
 * Tests for lib/v5/install-stamp.mjs — the v5 install-stamp resolver.
 *
 * Covers all resolution paths:
 *   1. kit-nested (v5.3+):  {projectRoot}/{kitFolder}/.mc/install.json
 *   2. root (v5.2.0):       {projectRoot}/.mc/install.json
 *   3. v4 legacy:           {projectRoot}/docs/superpowers/control/.mc/install.json
 *   4. state.json fallback (no stamp anywhere)
 *   5. synthetic   (no stamp, no state.json)
 *
 * Plus writeInstallStamp atomicity (tmp + rename) and re-read symmetry.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  resolveInstallStamp,
  writeInstallStamp,
  stampCandidates,
} from '../lib/v5/install-stamp.mjs';

async function tmpProject() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'mc-v5-stamp-'));
}

test('stampCandidates lists the three paths in priority order (kit-nested first)', () => {
  const root = '/x/y';
  assert.deepEqual(stampCandidates(root), [
    path.join(root, 'mission-control-kit', '.mc', 'install.json'),
    path.join(root, '.mc', 'install.json'),
    path.join(root, 'docs', 'superpowers', 'control', '.mc', 'install.json'),
  ]);
});

test('stampCandidates honors a custom kit folder name', () => {
  const root = '/x/y';
  assert.equal(
    stampCandidates(root, { kitFolder: 'mc' })[0],
    path.join(root, 'mc', '.mc', 'install.json'),
  );
});

test('resolveInstallStamp picks the kit-nested location first', async () => {
  const project = await tmpProject();
  try {
    await fs.mkdir(path.join(project, 'mission-control-kit', '.mc'), { recursive: true });
    await fs.writeFile(
      path.join(project, 'mission-control-kit', '.mc', 'install.json'),
      JSON.stringify({ kitVersion: '5.3.0', migrationsApplied: ['x'] }),
    );
    const out = await resolveInstallStamp(project);
    assert.equal(out.source, 'stamp');
    assert.equal(out.stamp.kitVersion, '5.3.0');
    assert.equal(
      out.path,
      path.join(project, 'mission-control-kit', '.mc', 'install.json'),
    );
  } finally {
    await fs.rm(project, { recursive: true, force: true });
  }
});

test('resolveInstallStamp picks the root layout when only the root stamp exists', async () => {
  const project = await tmpProject();
  try {
    await fs.mkdir(path.join(project, '.mc'), { recursive: true });
    await fs.writeFile(
      path.join(project, '.mc', 'install.json'),
      JSON.stringify({ kitVersion: '5.2.0', migrationsApplied: ['x'] }),
    );
    const out = await resolveInstallStamp(project);
    assert.equal(out.source, 'stamp');
    assert.equal(out.stamp.kitVersion, '5.2.0');
    assert.equal(out.path, path.join(project, '.mc', 'install.json'));
  } finally {
    await fs.rm(project, { recursive: true, force: true });
  }
});

test('resolveInstallStamp falls back to v4 layout', async () => {
  const project = await tmpProject();
  try {
    const v4Dir = path.join(project, 'docs', 'superpowers', 'control', '.mc');
    await fs.mkdir(v4Dir, { recursive: true });
    await fs.writeFile(
      path.join(v4Dir, 'install.json'),
      JSON.stringify({ kitVersion: '4.7.1' }),
    );
    const out = await resolveInstallStamp(project);
    assert.equal(out.source, 'stamp');
    assert.equal(out.stamp.kitVersion, '4.7.1');
  } finally {
    await fs.rm(project, { recursive: true, force: true });
  }
});

test('resolveInstallStamp falls back to control/v5/state.json version', async () => {
  const project = await tmpProject();
  try {
    const v5Dir = path.join(project, 'control', 'v5');
    await fs.mkdir(v5Dir, { recursive: true });
    await fs.writeFile(
      path.join(v5Dir, 'state.json'),
      JSON.stringify({ version: '5.0.0', features: [] }),
    );
    const out = await resolveInstallStamp(project);
    assert.equal(out.source, 'state.json');
    assert.equal(out.stamp.kitVersion, '5.0.0');
    assert.deepEqual(out.stamp.migrationsApplied, []);
  } finally {
    await fs.rm(project, { recursive: true, force: true });
  }
});

test('resolveInstallStamp synthesizes a 0.0.0 stamp when nothing exists', async () => {
  const project = await tmpProject();
  try {
    const out = await resolveInstallStamp(project);
    assert.equal(out.source, 'synthetic');
    assert.equal(out.stamp.kitVersion, '0.0.0');
  } finally {
    await fs.rm(project, { recursive: true, force: true });
  }
});

test('resolveInstallStamp ignores stamps missing kitVersion field', async () => {
  const project = await tmpProject();
  try {
    await fs.mkdir(path.join(project, '.mc'), { recursive: true });
    await fs.writeFile(
      path.join(project, '.mc', 'install.json'),
      JSON.stringify({ notes: 'no kitVersion field' }),
    );
    // Also no state.json — should synthesize.
    const out = await resolveInstallStamp(project);
    assert.equal(out.source, 'synthetic');
  } finally {
    await fs.rm(project, { recursive: true, force: true });
  }
});

test('writeInstallStamp writes atomically and is round-trippable (kit-nested default)', async () => {
  const project = await tmpProject();
  try {
    const stamp = {
      kitVersion: '5.3.0',
      schemaVersion: 1,
      migrationsApplied: ['5.0.0-v5-refactor', '5.1.0-expanded-primitives'],
    };
    const written = await writeInstallStamp(project, stamp);
    assert.equal(
      written,
      path.join(project, 'mission-control-kit', '.mc', 'install.json'),
    );
    const round = await resolveInstallStamp(project);
    assert.equal(round.source, 'stamp');
    assert.equal(round.stamp.kitVersion, '5.3.0');
    assert.deepEqual(round.stamp.migrationsApplied, stamp.migrationsApplied);
  } finally {
    await fs.rm(project, { recursive: true, force: true });
  }
});

test('writeInstallStamp preserves an existing root-layout stamp location', async () => {
  const project = await tmpProject();
  try {
    // Seed an existing root-layout stamp.
    await fs.mkdir(path.join(project, '.mc'), { recursive: true });
    await fs.writeFile(
      path.join(project, '.mc', 'install.json'),
      JSON.stringify({ kitVersion: '5.2.0' }),
    );

    const written = await writeInstallStamp(project, { kitVersion: '5.2.1' });
    // Must NOT relocate to the kit-nested layout — keep writing where
    // the user's existing stamp already lives.
    assert.equal(written, path.join(project, '.mc', 'install.json'));
  } finally {
    await fs.rm(project, { recursive: true, force: true });
  }
});

test('writeInstallStamp rejects a stamp with no kitVersion', async () => {
  const project = await tmpProject();
  try {
    await assert.rejects(
      () => writeInstallStamp(project, { migrationsApplied: [] }),
      /kitVersion must be a string/,
    );
  } finally {
    await fs.rm(project, { recursive: true, force: true });
  }
});
