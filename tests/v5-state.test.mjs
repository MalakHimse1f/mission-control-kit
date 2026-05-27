// tests/v5-state.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { makeTmpProject } from './helpers/tmp-project.mjs';
import { readState, writeState, upsertFeature, setActiveFeature } from '../lib/v5/state.mjs';

test('readState returns default when state.json is missing', async () => {
  const { root, cleanup } = await makeTmpProject({ withState: false });
  try {
    const state = await readState({ controlRoot: root });
    assert.equal(state.version, '5.0.0');
    assert.deepEqual(state.features, []);
    assert.equal(state.activeFeature, null);
  } finally {
    await cleanup();
  }
});

test('upsertFeature adds then updates a feature by slug', async () => {
  const { root, cleanup } = await makeTmpProject();
  try {
    await upsertFeature({ slug: 'a', stage: 'needs-input', currentPhase: 'ux' }, { controlRoot: root });
    let state = await readState({ controlRoot: root });
    assert.equal(state.features.length, 1);
    assert.equal(state.features[0].stage, 'needs-input');

    await upsertFeature({ slug: 'a', stage: 'in-progress', currentPhase: 'build' }, { controlRoot: root });
    state = await readState({ controlRoot: root });
    assert.equal(state.features.length, 1, 'upsert must not duplicate by slug');
    assert.equal(state.features[0].stage, 'in-progress');
    assert.equal(state.features[0].currentPhase, 'build');
  } finally {
    await cleanup();
  }
});

test('setActiveFeature sets the pointer and writes atomically', async () => {
  const { root, cleanup } = await makeTmpProject();
  try {
    await setActiveFeature('a', { controlRoot: root });
    const state = await readState({ controlRoot: root });
    assert.equal(state.activeFeature, 'a');
    const dir = await fs.readdir(path.join(root, 'control', 'v5'));
    assert.ok(!dir.some((f) => f.endsWith('.tmp')), 'no .tmp left behind');
  } finally {
    await cleanup();
  }
});

test('writeState always refreshes updatedAt', async () => {
  const { root, cleanup } = await makeTmpProject();
  try {
    const before = (await readState({ controlRoot: root })).updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    const after = (await writeState({ features: [] }, { controlRoot: root })).updatedAt;
    assert.notEqual(before, after);
  } finally {
    await cleanup();
  }
});
