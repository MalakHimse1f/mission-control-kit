/**
 * Tests for migrations/5.2.0-v5-native-layout.mjs — the layout migration
 * that converts v5.1.x-on-v4-rooted-layout installs to the v5-native
 * layout where `control/v5/` lives at the project root and the install
 * stamp lives at `{projectRoot}/.mc/install.json`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { up as layoutMigration } from '../migrations/5.2.0-v5-native-layout.mjs';

async function tmpProject() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'mc-v52-layout-'));
}

async function exists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Seed a v4-rooted v5.1.x install in `root`:
 *   docs/superpowers/control/v5/features/...      ← user content
 *   docs/superpowers/control/.mc/install.json     ← legacy stamp
 *   docs/superpowers/control/ROUTER.md            ← v4 chrome
 */
async function seedV4RootedInstall(root) {
  const legacyControl = path.join(root, 'docs', 'superpowers', 'control');
  const v5 = path.join(legacyControl, 'v5');
  await fs.mkdir(path.join(v5, 'features', 'demo'), { recursive: true });
  await fs.writeFile(
    path.join(v5, 'features', 'demo', 'status.json'),
    JSON.stringify({ slug: 'demo', stage: 'needs-input' }),
    'utf8',
  );
  await fs.writeFile(path.join(v5, 'state.json'), JSON.stringify({ version: '5.1.1' }), 'utf8');
  await fs.mkdir(path.join(legacyControl, '.mc'), { recursive: true });
  await fs.writeFile(
    path.join(legacyControl, '.mc', 'install.json'),
    JSON.stringify({ kitVersion: '5.1.1', migrationsApplied: ['5.0.0-v5-refactor', '5.1.0-expanded-primitives', '5.1.1-install-stamp-backfill'] }),
    'utf8',
  );
  await fs.writeFile(path.join(legacyControl, 'ROUTER.md'), '# legacy v4 router\n', 'utf8');
  await fs.mkdir(path.join(legacyControl, 'scripts'), { recursive: true });
  await fs.writeFile(path.join(legacyControl, 'scripts', 'dashboard-template.mjs'), '// v4 chrome\n', 'utf8');
}

test('moves docs/superpowers/control/v5/ to control/v5/', async () => {
  const root = await tmpProject();
  try {
    await seedV4RootedInstall(root);
    await layoutMigration({ projectRoot: root, controlRoot: path.join(root, 'control'), kitRoot: '/dev/null', log: () => {} });

    assert.ok(await exists(path.join(root, 'control', 'v5')), 'control/v5 should exist');
    assert.ok(
      await exists(path.join(root, 'control', 'v5', 'features', 'demo', 'status.json')),
      'user feature should have moved',
    );
    assert.ok(await exists(path.join(root, 'control', 'v5', 'state.json')));
    assert.ok(
      !(await exists(path.join(root, 'docs', 'superpowers', 'control', 'v5'))),
      'legacy v5 dir should be gone',
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('relocates install stamp to {projectRoot}/.mc/install.json', async () => {
  const root = await tmpProject();
  try {
    await seedV4RootedInstall(root);
    await layoutMigration({ projectRoot: root, controlRoot: path.join(root, 'control'), kitRoot: '/dev/null', log: () => {} });
    const newStamp = JSON.parse(await fs.readFile(path.join(root, '.mc', 'install.json'), 'utf8'));
    assert.equal(newStamp.kitVersion, '5.1.1');
    assert.ok(
      !(await exists(path.join(root, 'docs', 'superpowers', 'control', '.mc', 'install.json'))),
      'legacy stamp should be gone',
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('archives v4 chrome under .mc/v4-legacy-archive/<timestamp>/', async () => {
  const root = await tmpProject();
  try {
    await seedV4RootedInstall(root);
    await layoutMigration({ projectRoot: root, controlRoot: path.join(root, 'control'), kitRoot: '/dev/null', log: () => {} });
    const archiveRoot = path.join(root, '.mc', 'v4-legacy-archive');
    assert.ok(await exists(archiveRoot), 'v4-legacy-archive should exist');
    const stamps = await fs.readdir(archiveRoot);
    assert.equal(stamps.length, 1);
    const archive = path.join(archiveRoot, stamps[0]);
    assert.ok(await exists(path.join(archive, 'ROUTER.md')));
    assert.ok(await exists(path.join(archive, 'scripts', 'dashboard-template.mjs')));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('removes the empty docs/superpowers/ tree when nothing else is there', async () => {
  const root = await tmpProject();
  try {
    await seedV4RootedInstall(root);
    await layoutMigration({ projectRoot: root, controlRoot: path.join(root, 'control'), kitRoot: '/dev/null', log: () => {} });
    assert.ok(!(await exists(path.join(root, 'docs', 'superpowers'))), 'docs/superpowers should be removed');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('is a no-op when no legacy layout exists', async () => {
  const root = await tmpProject();
  try {
    // Fresh project: just .mc/install.json + control/v5/ already in place.
    await fs.mkdir(path.join(root, 'control', 'v5'), { recursive: true });
    await fs.mkdir(path.join(root, '.mc'), { recursive: true });
    await fs.writeFile(
      path.join(root, '.mc', 'install.json'),
      JSON.stringify({ kitVersion: '5.2.0' }),
    );
    await layoutMigration({ projectRoot: root, controlRoot: path.join(root, 'control'), kitRoot: '/dev/null', log: () => {} });
    const stamp = JSON.parse(await fs.readFile(path.join(root, '.mc', 'install.json'), 'utf8'));
    assert.equal(stamp.kitVersion, '5.2.0', 'stamp should be untouched');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('merges legacy v5/ contents into existing native v5/ without clobbering', async () => {
  const root = await tmpProject();
  try {
    await seedV4RootedInstall(root);
    // Pre-existing native v5/ with overlapping content; should win.
    const nativeV5 = path.join(root, 'control', 'v5');
    await fs.mkdir(path.join(nativeV5, 'features', 'demo'), { recursive: true });
    await fs.writeFile(
      path.join(nativeV5, 'features', 'demo', 'status.json'),
      JSON.stringify({ slug: 'demo', stage: 'in-progress', winner: 'native' }),
      'utf8',
    );
    await layoutMigration({ projectRoot: root, controlRoot: path.join(root, 'control'), kitRoot: '/dev/null', log: () => {} });
    const kept = JSON.parse(
      await fs.readFile(path.join(nativeV5, 'features', 'demo', 'status.json'), 'utf8'),
    );
    assert.equal(kept.winner, 'native', 'pre-existing native file should not be overwritten');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
