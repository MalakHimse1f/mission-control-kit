// tests/v5-feature-scaffold.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { makeTmpProject } from './helpers/tmp-project.mjs';
import { scaffoldFeature } from '../lib/v5/feature-scaffold.mjs';
import { readDecisions } from '../lib/v5/decisions.mjs';
import { readState, upsertFeature } from '../lib/v5/state.mjs';

async function readJson(p) {
  return JSON.parse(await fs.readFile(p, 'utf8'));
}

test('scaffoldFeature creates status.json, decisions.json, and registers in state', async () => {
  const { root, cleanup } = await makeTmpProject();
  try {
    const res = await scaffoldFeature(
      { slug: 'user-onboarding', description: 'Sign-up flow', controlRoot: root },
    );
    assert.equal(res.created, true);
    assert.equal(res.currentPhase, 'ux');

    const status = await readJson(res.statusPath);
    assert.equal(status.slug, 'user-onboarding');
    assert.equal(status.featureType, 'feature');
    assert.equal(status.stage, 'needs-input');
    assert.equal(status.currentPhase, 'ux');
    assert.equal(status.description, 'Sign-up flow');

    const decisions = await readDecisions('user-onboarding', { controlRoot: root });
    assert.equal(decisions.feature, 'user-onboarding');
    assert.deepEqual(Object.keys(decisions.phases).sort(), ['architecture', 'ui', 'ux']);

    const state = await readState({ controlRoot: root });
    assert.ok(state.features.some((f) => f.slug === 'user-onboarding'));
  } finally {
    await cleanup();
  }
});

test('tech-stack featureType starts at architecture phase', async () => {
  const { root, cleanup } = await makeTmpProject();
  try {
    const res = await scaffoldFeature(
      { slug: 'platform', featureType: 'tech-stack', controlRoot: root },
    );
    assert.equal(res.currentPhase, 'architecture');
    const status = await readJson(res.statusPath);
    assert.equal(status.featureType, 'tech-stack');
    assert.equal(status.currentPhase, 'architecture');
  } finally {
    await cleanup();
  }
});

test('scaffoldFeature is idempotent — does not clobber an existing feature', async () => {
  const { root, cleanup } = await makeTmpProject();
  try {
    await scaffoldFeature({ slug: 'a', description: 'first', controlRoot: root });
    const statusPath = path.join(root, 'control', 'v5', 'features', 'a', 'status.json');
    const status = await readJson(statusPath);
    status.stage = 'in-progress';
    await fs.writeFile(statusPath, JSON.stringify(status, null, 2) + '\n', 'utf8');

    const res = await scaffoldFeature({ slug: 'a', description: 'second', controlRoot: root });
    assert.equal(res.created, false);
    const after = await readJson(statusPath);
    assert.equal(after.stage, 'in-progress', 'must not overwrite existing status');
    assert.equal(after.description, 'first', 'must not overwrite existing description');
  } finally {
    await cleanup();
  }
});

test('re-scaffold does not reset an advanced state.json stage', async () => {
  const { root, cleanup } = await makeTmpProject();
  try {
    await scaffoldFeature({ slug: 'a', controlRoot: root });
    await upsertFeature({ slug: 'a', stage: 'in-progress', currentPhase: 'build' }, { controlRoot: root });
    await scaffoldFeature({ slug: 'a', controlRoot: root });
    const state = await readState({ controlRoot: root });
    const entry = state.features.find((f) => f.slug === 'a');
    assert.equal(entry.stage, 'in-progress', 're-scaffold must not reset stage');
    assert.equal(entry.currentPhase, 'build');
  } finally {
    await cleanup();
  }
});

test('scaffoldFeature rejects bad slug and featureType', async () => {
  const { root, cleanup } = await makeTmpProject();
  try {
    await assert.rejects(() => scaffoldFeature({ slug: '', controlRoot: root }));
    await assert.rejects(() => scaffoldFeature({ slug: 'x', featureType: 'nope', controlRoot: root }));
  } finally {
    await cleanup();
  }
});
