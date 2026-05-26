import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { fileURLToPath } from 'node:url';

import { up, version } from '../migrations/5.0.0-v5-refactor.mjs';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ROUTING_FILES = [
  'ROUTING-MANIFEST.md',
  'UI-REQUIREMENTS.md',
  'UX-PATTERNS.md',
  'ARCHITECTURE.md',
  'BUILD-GATES.md',
];

let tmpProject;
let controlRoot;

function seedV4Content() {
  // Simulate a real v4 control plane the migration must not touch.
  fs.mkdirSync(path.join(controlRoot, 'features', 'user-feat'), { recursive: true });
  fs.writeFileSync(
    path.join(controlRoot, 'features', 'user-feat', 'spec.md'),
    '# User Feature v4\nKeep me intact.\n',
  );
  fs.writeFileSync(
    path.join(controlRoot, 'state.json'),
    JSON.stringify({ version: '4.7.1', features: ['user-feat'] }, null, 2),
  );
  fs.writeFileSync(
    path.join(controlRoot, 'ROUTER.md'),
    '# v4 Router\nUser edits.\n',
  );
}

function snapshotDir(dir) {
  if (!fs.existsSync(dir)) return {};
  const out = {};
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const name of fs.readdirSync(cur)) {
      const full = path.join(cur, name);
      const rel = path.relative(dir, full);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) stack.push(full);
      else out[rel] = fs.readFileSync(full, 'utf8');
    }
  }
  return out;
}

describe('5.0.0-v5-refactor migration', () => {
  beforeEach(() => {
    tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-v5-migration-'));
    controlRoot = path.join(tmpProject, 'docs/superpowers/control');
    fs.mkdirSync(controlRoot, { recursive: true });
    seedV4Content();
  });

  afterEach(() => {
    fs.rmSync(tmpProject, { recursive: true, force: true });
  });

  it('exposes the expected version string', () => {
    assert.equal(version, '5.0.0-v5-refactor');
  });

  it('creates control/v5/ skeleton when missing', async () => {
    await up({ controlRoot, kitRoot });
    assert.ok(fs.statSync(path.join(controlRoot, 'v5')).isDirectory());
    assert.ok(fs.statSync(path.join(controlRoot, 'v5', 'routing')).isDirectory());
    assert.ok(fs.statSync(path.join(controlRoot, 'v5', 'features')).isDirectory());
    assert.ok(fs.statSync(path.join(controlRoot, 'v5', 'tech-stack')).isDirectory());
    assert.ok(fs.statSync(path.join(controlRoot, 'v5', '_diagram-assets')).isDirectory());
  });

  it('copies the five routing markdown files from the kit', async () => {
    await up({ controlRoot, kitRoot });
    for (const file of ROUTING_FILES) {
      const dest = path.join(controlRoot, 'v5', 'routing', file);
      assert.ok(fs.existsSync(dest), `expected ${file} to be copied`);
      const src = path.join(kitRoot, 'control', 'v5', 'routing', file);
      assert.equal(
        fs.readFileSync(dest, 'utf8'),
        fs.readFileSync(src, 'utf8'),
        `${file} content should match kit source`,
      );
    }
  });

  it('copies diagram _shared/* css and js assets into _diagram-assets/', async () => {
    await up({ controlRoot, kitRoot });
    const destDir = path.join(controlRoot, 'v5', '_diagram-assets');
    const kitShared = path.join(kitRoot, 'control', 'layout', 'diagrams', '_shared');
    const expectedAssets = fs
      .readdirSync(kitShared)
      .filter((n) => /\.(css|js)$/.test(n));
    assert.ok(expectedAssets.length > 0, 'kit must have shared assets to copy');
    for (const asset of expectedAssets) {
      assert.ok(
        fs.existsSync(path.join(destDir, asset)),
        `expected _diagram-assets/${asset}`,
      );
    }
  });

  it('is idempotent — running twice leaves v5/ unchanged', async () => {
    await up({ controlRoot, kitRoot });
    const firstSnap = snapshotDir(path.join(controlRoot, 'v5'));
    // Mutate one file as if a user edited it; second run must NOT clobber.
    const userTouched = path.join(controlRoot, 'v5', 'routing', 'ROUTING-MANIFEST.md');
    const userContent = '# user override\n';
    fs.writeFileSync(userTouched, userContent);

    await up({ controlRoot, kitRoot });
    assert.equal(fs.readFileSync(userTouched, 'utf8'), userContent);

    // Aside from the user override, no other file should change.
    const secondSnap = snapshotDir(path.join(controlRoot, 'v5'));
    for (const [rel, content] of Object.entries(firstSnap)) {
      if (rel === path.join('routing', 'ROUTING-MANIFEST.md')) continue;
      // state.json carries updatedAt — only set on first run, then preserved.
      assert.equal(secondSnap[rel], content, `${rel} should be unchanged on rerun`);
    }
  });

  it('does not touch existing v4 control content', async () => {
    const v4Snap = {
      'features/user-feat/spec.md': fs.readFileSync(
        path.join(controlRoot, 'features', 'user-feat', 'spec.md'),
        'utf8',
      ),
      'state.json': fs.readFileSync(path.join(controlRoot, 'state.json'), 'utf8'),
      'ROUTER.md': fs.readFileSync(path.join(controlRoot, 'ROUTER.md'), 'utf8'),
    };

    await up({ controlRoot, kitRoot });

    for (const [rel, expected] of Object.entries(v4Snap)) {
      assert.equal(
        fs.readFileSync(path.join(controlRoot, rel), 'utf8'),
        expected,
        `v4 ${rel} must not be modified`,
      );
    }
  });

  it('writes a control/v5/state.json stub when missing', async () => {
    await up({ controlRoot, kitRoot });
    const statePath = path.join(controlRoot, 'v5', 'state.json');
    assert.ok(fs.existsSync(statePath));
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.equal(state.version, '5.0.0');
    assert.deepEqual(state.features, []);
    assert.ok(typeof state.updatedAt === 'string' && state.updatedAt.length > 0);
  });

  it('preserves an existing control/v5/state.json on rerun', async () => {
    const v5Root = path.join(controlRoot, 'v5');
    fs.mkdirSync(v5Root, { recursive: true });
    const userState = { version: '5.0.0', features: ['mine'], updatedAt: 'frozen' };
    fs.writeFileSync(
      path.join(v5Root, 'state.json'),
      `${JSON.stringify(userState, null, 2)}\n`,
    );

    await up({ controlRoot, kitRoot });

    const got = JSON.parse(fs.readFileSync(path.join(v5Root, 'state.json'), 'utf8'));
    assert.deepEqual(got, userState);
  });

  it('invokes the optional log function when provided', async () => {
    const calls = [];
    await up({ controlRoot, kitRoot, log: (msg) => calls.push(msg) });
    assert.ok(calls.length > 0, 'expected log to be called at least once');
    assert.ok(calls.some((m) => m.includes('5.0.0')));
  });

  it('throws when controlRoot or kitRoot is missing', async () => {
    await assert.rejects(() => up({}), /controlRoot and kitRoot are required/);
    await assert.rejects(() => up({ controlRoot }), /controlRoot and kitRoot are required/);
    await assert.rejects(() => up({ kitRoot }), /controlRoot and kitRoot are required/);
  });
});
