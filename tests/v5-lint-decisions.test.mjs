/** Tests for lib/v5/lint-decisions.mjs */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { lintDecisions, lintAllFeatures } from '../lib/v5/lint-decisions.mjs';

async function makeTmpControlRoot() {
  // `controlRoot` is the project root — the directory CONTAINING `control/v5/`.
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-v5-lint-'));
  await fs.mkdir(path.join(dir, 'control', 'v5'), { recursive: true });
  return { tmpDir: dir, controlRoot: dir };
}

async function writeDecisionsJson(controlRoot, slug, decisions) {
  const filePath = path.join(
    controlRoot,
    'control',
    'v5',
    'features',
    slug,
    'decisions.json',
  );
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(decisions, null, 2) + '\n', 'utf8');
}

async function writeFragment(controlRoot, slug, decisionId, content) {
  const filePath = path.join(
    controlRoot,
    'control',
    'v5',
    'features',
    slug,
    'decisions',
    `${decisionId}.html`,
  );
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

function makeDecisions(slug, decisionIds = []) {
  const decisions = {
    feature: slug,
    phases: {
      ux: { status: 'not-started', decisions: [], pending: [] },
      ui: { status: 'not-started', decisions: [], pending: [] },
      architecture: { status: 'not-started', decisions: [], pending: [] },
    },
    deferred: [],
    updatedAt: new Date().toISOString(),
  };

  // Distribute decisions across phases
  const phases = ['ux', 'ui', 'architecture'];
  decisionIds.forEach((id, i) => {
    const phase = phases[i % 3];
    decisions.phases[phase].decisions.push({
      id,
      category: phase === 'architecture' ? 'engineering' : phase,
      question: `Question for ${id}?`,
      options: [`Option A`, `Option B`],
      selected: `Option A`,
      decidedAt: new Date().toISOString(),
    });
  });

  return decisions;
}

test('lintDecisions: no decisions.json returns empty violations', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  const result = await lintDecisions({ slug: 'new-feature', controlRoot });
  assert.equal(result.slug, 'new-feature');
  assert.deepEqual(result.violations, []);
});

test('lintDecisions: decisions with matching fragments returns no violations', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  const slug = 'feature-a';
  const decisions = makeDecisions(slug, ['d1', 'd2', 'd3']);
  await writeDecisionsJson(controlRoot, slug, decisions);

  // Write matching fragment files
  for (const id of ['d1', 'd2', 'd3']) {
    await writeFragment(
      controlRoot,
      slug,
      id,
      `<div class="mc-options-grid" data-group="${id}"></div>`,
    );
  }

  const result = await lintDecisions({ slug, controlRoot });
  assert.equal(result.violations.length, 0);
});

test('lintDecisions: missing fragment produces missing-fragment violation', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  const slug = 'feature-b';
  const decisions = makeDecisions(slug, ['d1', 'd2', 'd3']);
  await writeDecisionsJson(controlRoot, slug, decisions);

  // Write only 2 of 3 fragments
  await writeFragment(controlRoot, slug, 'd1', `<div class="mc-options-grid" data-group="d1"></div>`);
  await writeFragment(controlRoot, slug, 'd2', `<div class="mc-options-grid" data-group="d2"></div>`);

  const result = await lintDecisions({ slug, controlRoot });
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].type, 'missing-fragment');
  assert.equal(result.violations[0].decisionId, 'd3');
});

test('lintDecisions: orphan fragment produces orphan-fragment violation', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  const slug = 'feature-c';
  const decisions = makeDecisions(slug, ['d1', 'd2', 'd3']);
  await writeDecisionsJson(controlRoot, slug, decisions);

  // Write 3 expected fragments + 1 extra
  for (const id of ['d1', 'd2', 'd3', 'd4']) {
    await writeFragment(controlRoot, slug, id, `<div class="mc-options-grid" data-group="${id}"></div>`);
  }

  const result = await lintDecisions({ slug, controlRoot });
  const orphanViolations = result.violations.filter((v) => v.type === 'orphan-fragment');
  assert.equal(orphanViolations.length, 1);
  assert.equal(orphanViolations[0].decisionId, 'd4');
});

test('lintDecisions: mismatched data-group produces mismatched-group violation', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  const slug = 'feature-d';
  const decisions = makeDecisions(slug, ['d1', 'd2']);
  await writeDecisionsJson(controlRoot, slug, decisions);

  // Write fragments with wrong data-group for d1
  await writeFragment(controlRoot, slug, 'd1', `<div class="mc-options-grid" data-group="wrong"></div>`);
  await writeFragment(controlRoot, slug, 'd2', `<div class="mc-options-grid" data-group="d2"></div>`);

  const result = await lintDecisions({ slug, controlRoot });
  const mismatchViolations = result.violations.filter((v) => v.type === 'mismatched-group');
  assert.equal(mismatchViolations.length, 1);
  assert.equal(mismatchViolations[0].decisionId, 'd1');
});

test('lintDecisions: missing data-group attribute produces mismatched-group violation', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  const slug = 'feature-e';
  const decisions = makeDecisions(slug, ['d1']);
  await writeDecisionsJson(controlRoot, slug, decisions);

  // Write fragment without data-group attribute
  await writeFragment(controlRoot, slug, 'd1', `<div class="mc-options-grid"></div>`);

  const result = await lintDecisions({ slug, controlRoot });
  const mismatchViolations = result.violations.filter((v) => v.type === 'mismatched-group');
  assert.equal(mismatchViolations.length, 1);
  assert.equal(mismatchViolations[0].decisionId, 'd1');
});

test('lintDecisions: empty data-group attribute produces mismatched-group violation', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  const slug = 'feature-f';
  const decisions = makeDecisions(slug, ['d1']);
  await writeDecisionsJson(controlRoot, slug, decisions);

  // Write fragment with empty data-group
  await writeFragment(controlRoot, slug, 'd1', `<div class="mc-options-grid" data-group=""></div>`);

  const result = await lintDecisions({ slug, controlRoot });
  const mismatchViolations = result.violations.filter((v) => v.type === 'mismatched-group');
  assert.equal(mismatchViolations.length, 1);
  assert.equal(mismatchViolations[0].decisionId, 'd1');
});

test('lintAllFeatures: walks multiple features and sorts by slug', async () => {
  const { controlRoot } = await makeTmpControlRoot();

  // Create three features
  const features = ['zebra-feature', 'alpha-feature', 'beta-feature'];
  for (const slug of features) {
    const decisions = makeDecisions(slug, ['d1', 'd2']);
    await writeDecisionsJson(controlRoot, slug, decisions);
    // Write matching fragments for all
    for (const id of ['d1', 'd2']) {
      await writeFragment(controlRoot, slug, id, `<div class="mc-options-grid" data-group="${id}"></div>`);
    }
  }

  const result = await lintAllFeatures({ controlRoot });
  assert.equal(result.features.length, 3);

  // Verify sorted by slug
  assert.equal(result.features[0].slug, 'alpha-feature');
  assert.equal(result.features[1].slug, 'beta-feature');
  assert.equal(result.features[2].slug, 'zebra-feature');

  // Verify all have no violations
  for (const feature of result.features) {
    assert.equal(feature.violations.length, 0);
  }
});

test('lintAllFeatures: includes violations from multiple features', async () => {
  const { controlRoot } = await makeTmpControlRoot();

  // Feature with no violations
  const slug1 = 'good-feature';
  const decisions1 = makeDecisions(slug1, ['d1']);
  await writeDecisionsJson(controlRoot, slug1, decisions1);
  await writeFragment(controlRoot, slug1, 'd1', `<div class="mc-options-grid" data-group="d1"></div>`);

  // Feature with missing fragment
  const slug2 = 'bad-feature';
  const decisions2 = makeDecisions(slug2, ['d1', 'd2']);
  await writeDecisionsJson(controlRoot, slug2, decisions2);
  await writeFragment(controlRoot, slug2, 'd1', `<div class="mc-options-grid" data-group="d1"></div>`);
  // d2 is missing

  const result = await lintAllFeatures({ controlRoot });
  assert.equal(result.features.length, 2);

  const goodFeature = result.features.find((f) => f.slug === 'good-feature');
  const badFeature = result.features.find((f) => f.slug === 'bad-feature');

  assert.equal(goodFeature.violations.length, 0);
  assert.equal(badFeature.violations.length, 1);
  assert.equal(badFeature.violations[0].type, 'missing-fragment');
  assert.equal(badFeature.violations[0].decisionId, 'd2');
});

test('lintAllFeatures: empty features directory returns empty list', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  const result = await lintAllFeatures({ controlRoot });
  assert.deepEqual(result.features, []);
});

test('lintDecisions: throws on invalid arguments', async () => {
  const { controlRoot } = await makeTmpControlRoot();

  // Missing slug
  assert.rejects(
    () => lintDecisions({ controlRoot }),
    /slug must be a non-empty string/,
  );

  // Missing controlRoot
  assert.rejects(
    () => lintDecisions({ slug: 'test' }),
    /controlRoot must be a non-empty string/,
  );
});

test('lintAllFeatures: throws on invalid arguments', async () => {
  // Missing controlRoot
  assert.rejects(
    () => lintAllFeatures({}),
    /controlRoot must be a non-empty string/,
  );
});
