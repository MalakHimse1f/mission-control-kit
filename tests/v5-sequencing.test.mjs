/**
 * Tests for v5 decision sequencing — Task 9.
 *
 * Covers:
 *   - lib/v5/decision-gate.mjs (canAdvance, nextPhase, currentPhase, isTechStackFeature)
 *   - lib/v5/defer-question.mjs (deferQuestion re-export, isTechStackQuestion)
 *   - lib/v5/surface-deferred.mjs (surfaceDeferred, markDeferredResolved)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { writeDecisions, readDecisions } from '../lib/v5/decisions.mjs';
import {
  canAdvance,
  nextPhase,
  currentPhase,
  isTechStackFeature,
} from '../lib/v5/decision-gate.mjs';
import { deferQuestion, isTechStackQuestion } from '../lib/v5/defer-question.mjs';
import { surfaceDeferred, markDeferredResolved } from '../lib/v5/surface-deferred.mjs';

async function makeTmpControlRoot() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-v5-seq-'));
  const controlRoot = path.join(dir, 'control', 'v5');
  await fs.mkdir(controlRoot, { recursive: true });
  return { tmpDir: dir, controlRoot };
}

async function writeStatus(controlRoot, slug, payload) {
  const dir = path.join(controlRoot, 'features', slug);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'status.json'), JSON.stringify(payload, null, 2), 'utf8');
}

function emptyPhase() {
  return { status: 'not-started', decisions: [], pending: [] };
}

function makeDecision(id, category = 'ux') {
  return {
    id,
    category,
    question: `Question for ${id}?`,
    options: ['a', 'b'],
    selected: 'a',
    decidedAt: '2026-05-26T10:00:00Z',
  };
}

// ----- canAdvance ----------------------------------------------------------

test('canAdvance UX -> UI succeeds when UX is complete with empty pending', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions(
    'f1',
    {
      feature: 'f1',
      phases: {
        ux: { status: 'complete', decisions: [makeDecision('ux-1')], pending: [] },
        ui: emptyPhase(),
        architecture: emptyPhase(),
      },
    },
    { controlRoot },
  );
  const result = await canAdvance({
    slug: 'f1',
    fromPhase: 'ux',
    toPhase: 'ui',
    controlRoot,
  });
  assert.equal(result.allowed, true);
  assert.equal(result.reason, null);
  assert.deepEqual(result.pending, []);
});

test('canAdvance UX -> UI fails when UX has pending decisions', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions(
    'f2',
    {
      feature: 'f2',
      phases: {
        ux: { status: 'in-progress', decisions: [], pending: ['flow-style', 'entry-point'] },
        ui: emptyPhase(),
        architecture: emptyPhase(),
      },
    },
    { controlRoot },
  );
  const result = await canAdvance({
    slug: 'f2',
    fromPhase: 'ux',
    toPhase: 'ui',
    controlRoot,
  });
  assert.equal(result.allowed, false);
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
  assert.deepEqual(result.pending, ['flow-style', 'entry-point']);
});

test('canAdvance UX -> UI fails when UX status is not complete (even with empty pending)', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions(
    'f2b',
    {
      feature: 'f2b',
      phases: {
        ux: { status: 'in-progress', decisions: [], pending: [] },
        ui: emptyPhase(),
        architecture: emptyPhase(),
      },
    },
    { controlRoot },
  );
  const result = await canAdvance({
    slug: 'f2b',
    fromPhase: 'ux',
    toPhase: 'ui',
    controlRoot,
  });
  assert.equal(result.allowed, false);
  assert.ok(result.reason);
});

test('canAdvance UX -> Architecture fails for regular feature (would skip UI)', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions(
    'f3',
    {
      feature: 'f3',
      phases: {
        ux: { status: 'complete', decisions: [makeDecision('ux-1')], pending: [] },
        ui: emptyPhase(),
        architecture: emptyPhase(),
      },
    },
    { controlRoot },
  );
  await writeStatus(controlRoot, 'f3', { feature: 'f3', slug: 'f3' });
  const result = await canAdvance({
    slug: 'f3',
    fromPhase: 'ux',
    toPhase: 'architecture',
    controlRoot,
  });
  assert.equal(result.allowed, false);
  assert.ok(result.reason);
  assert.match(result.reason, /skip|order|sequence|ui/i);
});

test('canAdvance UX -> Architecture succeeds for tech-stack feature', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions(
    'f4',
    {
      feature: 'f4',
      phases: {
        ux: { status: 'complete', decisions: [], pending: [] },
        ui: emptyPhase(),
        architecture: emptyPhase(),
      },
    },
    { controlRoot },
  );
  await writeStatus(controlRoot, 'f4', { feature: 'f4', slug: 'f4', featureType: 'tech-stack' });
  const result = await canAdvance({
    slug: 'f4',
    fromPhase: 'ux',
    toPhase: 'architecture',
    controlRoot,
  });
  assert.equal(result.allowed, true, `expected allowed; reason: ${result.reason}`);
});

test('canAdvance UI -> Architecture succeeds when UI complete', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions(
    'f5',
    {
      feature: 'f5',
      phases: {
        ux: { status: 'complete', decisions: [], pending: [] },
        ui: { status: 'complete', decisions: [makeDecision('ui-1', 'ui')], pending: [] },
        architecture: emptyPhase(),
      },
    },
    { controlRoot },
  );
  const result = await canAdvance({
    slug: 'f5',
    fromPhase: 'ui',
    toPhase: 'architecture',
    controlRoot,
  });
  assert.equal(result.allowed, true, `expected allowed; reason: ${result.reason}`);
});

test('canAdvance Architecture -> Build succeeds when architecture complete', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions(
    'f6',
    {
      feature: 'f6',
      phases: {
        ux: { status: 'complete', decisions: [], pending: [] },
        ui: { status: 'complete', decisions: [], pending: [] },
        architecture: {
          status: 'complete',
          decisions: [makeDecision('arch-1', 'engineering')],
          pending: [],
        },
      },
    },
    { controlRoot },
  );
  const result = await canAdvance({
    slug: 'f6',
    fromPhase: 'architecture',
    toPhase: 'build',
    controlRoot,
  });
  assert.equal(result.allowed, true, `expected allowed; reason: ${result.reason}`);
});

test('canAdvance Architecture -> Build fails with pending', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions(
    'f7',
    {
      feature: 'f7',
      phases: {
        ux: { status: 'complete', decisions: [], pending: [] },
        ui: { status: 'complete', decisions: [], pending: [] },
        architecture: {
          status: 'in-progress',
          decisions: [],
          pending: ['transport', 'storage'],
        },
      },
    },
    { controlRoot },
  );
  const result = await canAdvance({
    slug: 'f7',
    fromPhase: 'architecture',
    toPhase: 'build',
    controlRoot,
  });
  assert.equal(result.allowed, false);
  assert.deepEqual(result.pending, ['transport', 'storage']);
});

test('canAdvance rejects invalid phase names', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions('f8', {}, { controlRoot });
  const result = await canAdvance({
    slug: 'f8',
    fromPhase: 'nonsense',
    toPhase: 'ui',
    controlRoot,
  });
  assert.equal(result.allowed, false);
  assert.ok(result.reason);
});

test('canAdvance rejects backward transitions (UI -> UX)', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions(
    'f9',
    {
      feature: 'f9',
      phases: {
        ux: { status: 'complete', decisions: [], pending: [] },
        ui: { status: 'complete', decisions: [], pending: [] },
        architecture: emptyPhase(),
      },
    },
    { controlRoot },
  );
  const result = await canAdvance({
    slug: 'f9',
    fromPhase: 'ui',
    toPhase: 'ux',
    controlRoot,
  });
  assert.equal(result.allowed, false);
});

// ----- nextPhase ----------------------------------------------------------

test('nextPhase for regular feature: null -> ux -> ui -> architecture -> build -> done', () => {
  assert.equal(nextPhase(null, false), 'ux');
  assert.equal(nextPhase('ux', false), 'ui');
  assert.equal(nextPhase('ui', false), 'architecture');
  assert.equal(nextPhase('architecture', false), 'build');
  assert.equal(nextPhase('build', false), 'done');
});

test('nextPhase for tech-stack: null -> architecture -> build -> done', () => {
  assert.equal(nextPhase(null, true), 'architecture');
  assert.equal(nextPhase('architecture', true), 'build');
  assert.equal(nextPhase('build', true), 'done');
});

test('nextPhase throws on unknown phase', () => {
  assert.throws(() => nextPhase('nonsense', false), /phase/i);
});

// ----- currentPhase -------------------------------------------------------

test('currentPhase returns the in-progress phase', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions(
    'cp1',
    {
      feature: 'cp1',
      phases: {
        ux: { status: 'complete', decisions: [], pending: [] },
        ui: { status: 'in-progress', decisions: [], pending: ['component-pick'] },
        architecture: emptyPhase(),
      },
    },
    { controlRoot },
  );
  const phase = await currentPhase({ slug: 'cp1', controlRoot });
  assert.equal(phase, 'ui');
});

test('currentPhase defaults to ux when no phases started (regular feature)', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  // No decisions file at all.
  await writeStatus(controlRoot, 'cp2', { feature: 'cp2', slug: 'cp2' });
  const phase = await currentPhase({ slug: 'cp2', controlRoot });
  assert.equal(phase, 'ux');
});

test('currentPhase defaults to architecture for tech-stack feature with nothing started', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeStatus(controlRoot, 'cp3', {
    feature: 'cp3',
    slug: 'cp3',
    featureType: 'tech-stack',
  });
  const phase = await currentPhase({ slug: 'cp3', controlRoot });
  assert.equal(phase, 'architecture');
});

test('currentPhase returns build when all phases are complete', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions(
    'cp4',
    {
      feature: 'cp4',
      phases: {
        ux: { status: 'complete', decisions: [], pending: [] },
        ui: { status: 'complete', decisions: [], pending: [] },
        architecture: { status: 'complete', decisions: [], pending: [] },
      },
    },
    { controlRoot },
  );
  const phase = await currentPhase({ slug: 'cp4', controlRoot });
  assert.equal(phase, 'build');
});

test('currentPhase picks the first not-started phase after a complete one', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions(
    'cp5',
    {
      feature: 'cp5',
      phases: {
        ux: { status: 'complete', decisions: [], pending: [] },
        ui: emptyPhase(),
        architecture: emptyPhase(),
      },
    },
    { controlRoot },
  );
  const phase = await currentPhase({ slug: 'cp5', controlRoot });
  assert.equal(phase, 'ui');
});

// ----- isTechStackFeature -------------------------------------------------

test('isTechStackFeature returns true when status.json has featureType=tech-stack', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeStatus(controlRoot, 'ts1', { slug: 'ts1', featureType: 'tech-stack' });
  assert.equal(await isTechStackFeature('ts1', controlRoot), true);
});

test('isTechStackFeature returns false for regular feature', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeStatus(controlRoot, 'ts2', { slug: 'ts2' });
  assert.equal(await isTechStackFeature('ts2', controlRoot), false);
});

test('isTechStackFeature returns false when status.json missing', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  assert.equal(await isTechStackFeature('ts3', controlRoot), false);
});

// ----- isTechStackQuestion ------------------------------------------------

test('isTechStackQuestion detects "What database should we use?" -> true', () => {
  assert.equal(isTechStackQuestion('What database should we use?'), true);
});

test('isTechStackQuestion detects "How does the user navigate?" -> false', () => {
  assert.equal(isTechStackQuestion('How does the user navigate?'), false);
});

test('isTechStackQuestion catches common tech keywords', () => {
  assert.equal(isTechStackQuestion('Which API should we expose?'), true);
  assert.equal(isTechStackQuestion('What is the deployment target?'), true);
  assert.equal(isTechStackQuestion('Pick a framework for the frontend.'), true);
  assert.equal(isTechStackQuestion('Library or in-house?'), true);
  assert.equal(isTechStackQuestion('Service mesh or monolith?'), true);
  assert.equal(isTechStackQuestion('Update the stack diagram.'), true);
  assert.equal(isTechStackQuestion('What infrastructure do we need?'), true);
});

test('isTechStackQuestion is case-insensitive', () => {
  assert.equal(isTechStackQuestion('DATABASE choice?'), true);
  assert.equal(isTechStackQuestion('Framework?'), true);
});

test('isTechStackQuestion returns false for empty / non-string input', () => {
  assert.equal(isTechStackQuestion(''), false);
  assert.equal(isTechStackQuestion(null), false);
  assert.equal(isTechStackQuestion(undefined), false);
  assert.equal(isTechStackQuestion(123), false);
});

// ----- deferQuestion re-export --------------------------------------------

test('deferQuestion (from defer-question.mjs) writes to decisions.json deferred[]', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions('dq1', {}, { controlRoot });
  await deferQuestion({
    slug: 'dq1',
    question: 'Which database engine?',
    raisedDuring: 'ux',
    controlRoot,
  });
  const read = await readDecisions('dq1', { controlRoot });
  assert.equal(read.deferred.length, 1);
  assert.equal(read.deferred[0].question, 'Which database engine?');
  assert.equal(read.deferred[0].raisedDuring, 'ux');
  assert.ok(typeof read.deferred[0].raisedAt === 'string');
});

// ----- surfaceDeferred ----------------------------------------------------

test('surfaceDeferred at architecture returns all deferred questions', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions('sd1', {}, { controlRoot });
  await deferQuestion({
    slug: 'sd1',
    question: 'Which database?',
    raisedDuring: 'ux',
    controlRoot,
  });
  await deferQuestion({
    slug: 'sd1',
    question: 'Which API style?',
    raisedDuring: 'ui',
    controlRoot,
  });
  const surfaced = await surfaceDeferred({
    slug: 'sd1',
    atPhase: 'architecture',
    controlRoot,
  });
  assert.equal(surfaced.length, 2);
  assert.equal(surfaced[0].question, 'Which database?');
  assert.equal(surfaced[1].question, 'Which API style?');
});

test('surfaceDeferred at ux returns empty array', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions('sd2', {}, { controlRoot });
  await deferQuestion({
    slug: 'sd2',
    question: 'Which database?',
    raisedDuring: 'ux',
    controlRoot,
  });
  const surfaced = await surfaceDeferred({
    slug: 'sd2',
    atPhase: 'ux',
    controlRoot,
  });
  assert.deepEqual(surfaced, []);
});

test('surfaceDeferred at ui returns empty array', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions('sd3', {}, { controlRoot });
  await deferQuestion({
    slug: 'sd3',
    question: 'Which database?',
    raisedDuring: 'ux',
    controlRoot,
  });
  const surfaced = await surfaceDeferred({
    slug: 'sd3',
    atPhase: 'ui',
    controlRoot,
  });
  assert.deepEqual(surfaced, []);
});

test('surfaceDeferred is read-only (does not mutate deferred[])', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions('sd4', {}, { controlRoot });
  await deferQuestion({
    slug: 'sd4',
    question: 'Which database?',
    raisedDuring: 'ux',
    controlRoot,
  });
  await surfaceDeferred({ slug: 'sd4', atPhase: 'architecture', controlRoot });
  const read = await readDecisions('sd4', { controlRoot });
  assert.equal(read.deferred.length, 1);
});

// ----- markDeferredResolved -----------------------------------------------

test('markDeferredResolved removes entries by question text', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions('mr1', {}, { controlRoot });
  await deferQuestion({
    slug: 'mr1',
    question: 'Which database?',
    raisedDuring: 'ux',
    controlRoot,
  });
  await deferQuestion({
    slug: 'mr1',
    question: 'Which framework?',
    raisedDuring: 'ux',
    controlRoot,
  });
  await deferQuestion({
    slug: 'mr1',
    question: 'Which deployment target?',
    raisedDuring: 'ux',
    controlRoot,
  });

  await markDeferredResolved({
    slug: 'mr1',
    questionIds: ['Which framework?', 'Which deployment target?'],
    controlRoot,
  });

  const read = await readDecisions('mr1', { controlRoot });
  assert.equal(read.deferred.length, 1);
  assert.equal(read.deferred[0].question, 'Which database?');
});

test('markDeferredResolved with empty questionIds leaves deferred untouched', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions('mr2', {}, { controlRoot });
  await deferQuestion({
    slug: 'mr2',
    question: 'Q1?',
    raisedDuring: 'ux',
    controlRoot,
  });
  await markDeferredResolved({ slug: 'mr2', questionIds: [], controlRoot });
  const read = await readDecisions('mr2', { controlRoot });
  assert.equal(read.deferred.length, 1);
});

test('markDeferredResolved with unknown ids is a no-op (no throw)', async () => {
  const { controlRoot } = await makeTmpControlRoot();
  await writeDecisions('mr3', {}, { controlRoot });
  await deferQuestion({
    slug: 'mr3',
    question: 'Q1?',
    raisedDuring: 'ux',
    controlRoot,
  });
  await markDeferredResolved({
    slug: 'mr3',
    questionIds: ['Not a real question'],
    controlRoot,
  });
  const read = await readDecisions('mr3', { controlRoot });
  assert.equal(read.deferred.length, 1);
});
