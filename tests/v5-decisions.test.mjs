/** Tests for lib/v5/decisions.mjs and lib/v5/decisions-schema.mjs */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import {
  readDecisions,
  writeDecisions,
  markPhaseComplete,
  getPhaseStatus,
  deferQuestion,
} from '../lib/v5/decisions.mjs';
import { DECISIONS_SCHEMA, validateDecisions } from '../lib/v5/decisions-schema.mjs';

async function makeTmpControlRoot() {
  // `controlRoot` is the project root — the directory CONTAINING `control/v5/`.
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-v5-decisions-'));
  await fs.mkdir(path.join(dir, 'control', 'v5'), { recursive: true });
  return { tmpDir: dir, controlRoot: dir };
}

test('default empty structure has all three phase keys', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  const data = await readDecisions('new-feature', { controlRoot });
  assert.equal(data.feature, 'new-feature');
  assert.ok(data.phases.ux, 'expected phases.ux');
  assert.ok(data.phases.ui, 'expected phases.ui');
  assert.ok(data.phases.architecture, 'expected phases.architecture');
  assert.equal(data.phases.ux.status, 'not-started');
  assert.equal(data.phases.ui.status, 'not-started');
  assert.equal(data.phases.architecture.status, 'not-started');
  assert.deepEqual(data.deferred, []);
  assert.ok(typeof data.updatedAt === 'string');
});

test('round-trip: write then read returns same data', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  const payload = {
    feature: 'user-onboarding',
    phases: {
      ux: {
        status: 'complete',
        decisions: [
          {
            id: 'flow-style',
            category: 'ux',
            question: 'Onboarding flow style?',
            options: ['stepper', 'single-page', 'modal'],
            selected: 'stepper',
            decidedAt: '2026-05-26T10:00:00Z',
          },
        ],
        pending: [],
      },
      ui: { status: 'not-started', decisions: [], pending: [] },
      architecture: { status: 'not-started', decisions: [], pending: [] },
    },
    deferred: [],
    updatedAt: '2026-05-26T10:00:00Z',
  };
  await writeDecisions('user-onboarding', payload, { controlRoot });
  const read = await readDecisions('user-onboarding', { controlRoot });
  assert.equal(read.feature, 'user-onboarding');
  assert.equal(read.phases.ux.status, 'complete');
  assert.equal(read.phases.ux.decisions[0].id, 'flow-style');
  assert.equal(read.phases.ux.decisions[0].selected, 'stepper');
});

test('writeDecisions creates the feature directory if it does not exist (mkdir -p)', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions('brand-new-slug', { feature: 'brand-new-slug' }, { controlRoot });
  const filePath = path.join(
    controlRoot,
    'control',
    'v5',
    'features',
    'brand-new-slug',
    'decisions.json',
  );
  const stat = await fs.stat(filePath);
  assert.ok(stat.isFile(), 'expected decisions.json to be a file');
});

test('schema rejects payloads missing feature key', () => {
  const result = validateDecisions({
    phases: {
      ux: { status: 'not-started', decisions: [], pending: [] },
      ui: { status: 'not-started', decisions: [], pending: [] },
      architecture: { status: 'not-started', decisions: [], pending: [] },
    },
    deferred: [],
    updatedAt: '2026-05-26T10:00:00Z',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
  assert.ok(
    result.errors.some((e) => e.includes('feature')),
    `expected errors to mention feature, got: ${result.errors.join('; ')}`,
  );
});

test('schema rejects payloads where a phase has invalid status', () => {
  const result = validateDecisions({
    feature: 'foo',
    phases: {
      ux: { status: 'done', decisions: [], pending: [] },
      ui: { status: 'not-started', decisions: [], pending: [] },
      architecture: { status: 'not-started', decisions: [], pending: [] },
    },
    deferred: [],
    updatedAt: '2026-05-26T10:00:00Z',
  });
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((e) => e.includes('status')),
    `expected errors to mention status, got: ${result.errors.join('; ')}`,
  );
});

test('writeDecisions throws on invalid payload (e.g. bad status)', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await assert.rejects(
    () =>
      writeDecisions(
        'bad',
        {
          feature: 'bad',
          phases: {
            ux: { status: 'done', decisions: [], pending: [] },
            ui: { status: 'not-started', decisions: [], pending: [] },
            architecture: { status: 'not-started', decisions: [], pending: [] },
          },
          deferred: [],
          updatedAt: '2026-05-26T10:00:00Z',
        },
        { controlRoot },
      ),
    /status|invalid/i,
  );
});

test('writeDecisions auto-sets feature to slug when missing', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions('auto-feature', {}, { controlRoot });
  const read = await readDecisions('auto-feature', { controlRoot });
  assert.equal(read.feature, 'auto-feature');
});

test('writeDecisions throws when feature mismatches slug', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await assert.rejects(
    () => writeDecisions('slug-a', { feature: 'slug-b' }, { controlRoot }),
    /feature.*match|mismatch/i,
  );
});

test('writeDecisions updates updatedAt before writing', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  const before = new Date().toISOString();
  await new Promise((r) => setTimeout(r, 5));
  await writeDecisions(
    'time-test',
    { feature: 'time-test', updatedAt: '2000-01-01T00:00:00Z' },
    { controlRoot },
  );
  const read = await readDecisions('time-test', { controlRoot });
  assert.ok(read.updatedAt >= before, `expected updatedAt to be refreshed; got ${read.updatedAt}`);
});

test('markPhaseComplete sets status to complete and clears pending', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions(
    'mpc',
    {
      feature: 'mpc',
      phases: {
        ux: {
          status: 'in-progress',
          decisions: [
            {
              id: 'd1',
              category: 'ux',
              question: 'Q1',
              options: ['a', 'b'],
              selected: 'a',
              decidedAt: '2026-01-01T00:00:00Z',
            },
          ],
          pending: ['extra-question'],
        },
        ui: { status: 'not-started', decisions: [], pending: [] },
        architecture: { status: 'not-started', decisions: [], pending: [] },
      },
    },
    { controlRoot },
  );
  await markPhaseComplete('mpc', 'ux', { controlRoot });
  const read = await readDecisions('mpc', { controlRoot });
  assert.equal(read.phases.ux.status, 'complete');
  assert.deepEqual(read.phases.ux.pending, []);
  // decisions are preserved
  assert.equal(read.phases.ux.decisions.length, 1);
});

test('markPhaseComplete rejects unknown phase', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions('bad-phase', {}, { controlRoot });
  await assert.rejects(
    () => markPhaseComplete('bad-phase', 'nonsense', { controlRoot }),
    /phase/i,
  );
});

test('deferQuestion appends to deferred[] with question, raisedDuring, raisedAt', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions('def', {}, { controlRoot });
  await deferQuestion('def', 'Which database?', 'ux', { controlRoot });
  const read = await readDecisions('def', { controlRoot });
  assert.equal(read.deferred.length, 1);
  assert.equal(read.deferred[0].question, 'Which database?');
  assert.equal(read.deferred[0].raisedDuring, 'ux');
  assert.ok(typeof read.deferred[0].raisedAt === 'string');
  assert.ok(read.deferred[0].raisedAt.length > 0);
});

test('deferQuestion appends multiple entries in order', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions('def2', {}, { controlRoot });
  await deferQuestion('def2', 'Q1', 'ux', { controlRoot });
  await deferQuestion('def2', 'Q2', 'ui', { controlRoot });
  const read = await readDecisions('def2', { controlRoot });
  assert.equal(read.deferred.length, 2);
  assert.equal(read.deferred[0].question, 'Q1');
  assert.equal(read.deferred[1].question, 'Q2');
});

test('getPhaseStatus returns all three phase statuses', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions(
    'gps',
    {
      feature: 'gps',
      phases: {
        ux: { status: 'complete', decisions: [], pending: [] },
        ui: { status: 'in-progress', decisions: [], pending: [] },
        architecture: { status: 'not-started', decisions: [], pending: [] },
      },
    },
    { controlRoot },
  );
  const status = await getPhaseStatus('gps', { controlRoot });
  assert.equal(status.ux, 'complete');
  assert.equal(status.ui, 'in-progress');
  assert.equal(status.architecture, 'not-started');
});

test('getPhaseStatus defaults to not-started for unset phases (file does not exist)', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  const status = await getPhaseStatus('does-not-exist', { controlRoot });
  assert.equal(status.ux, 'not-started');
  assert.equal(status.ui, 'not-started');
  assert.equal(status.architecture, 'not-started');
});

test('DECISIONS_SCHEMA exports a recognizable schema constant', () => {
  assert.equal(typeof DECISIONS_SCHEMA, 'object');
  assert.ok(DECISIONS_SCHEMA.required || DECISIONS_SCHEMA.properties || DECISIONS_SCHEMA.phases);
});

test('validateDecisions accepts a well-formed payload', () => {
  const result = validateDecisions({
    feature: 'ok',
    phases: {
      ux: { status: 'complete', decisions: [], pending: [] },
      ui: { status: 'in-progress', decisions: [], pending: [] },
      architecture: { status: 'not-started', decisions: [], pending: [] },
    },
    deferred: [],
    updatedAt: '2026-05-26T10:00:00Z',
  });
  assert.equal(result.valid, true, `errors: ${result.errors.join('; ')}`);
  assert.deepEqual(result.errors, []);
});
