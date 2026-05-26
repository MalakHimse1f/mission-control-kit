/**
 * Tests for `lib/v5/current-task.mjs`.
 *
 * Covers the focused "what should I work on next?" helper that replaces the
 * pattern of reading the entire status.json.tasks[] array.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { currentTask, nextPendingTask } from '../lib/v5/current-task.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const sampleProjectRoot = path.join(repoRoot, 'sample-project');

async function makeFixture(statusJson) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-v5-current-task-'));
  const featureDir = path.join(tmpDir, 'control', 'v5', 'features', 'demo');
  await fs.mkdir(featureDir, { recursive: true });
  if (statusJson !== undefined) {
    await fs.writeFile(
      path.join(featureDir, 'status.json'),
      typeof statusJson === 'string' ? statusJson : JSON.stringify(statusJson, null, 2),
      'utf8',
    );
  }
  return { tmpDir, featureDir };
}

const SEVEN_TASK_FIXTURE = {
  feature: 'Demo',
  slug: 'demo',
  tasks: [
    { id: 't1', title: 'first done', status: 'done' },
    { id: 't2', title: 'second done', status: 'done' },
    { id: 't3', title: 'third done', status: 'done' },
    { id: 't4', title: 'fourth in progress', status: 'in-progress' },
    { id: 't5', title: 'fifth pending', status: 'pending' },
    { id: 't6', title: 'sixth pending', status: 'pending' },
    { id: 't7', title: 'seventh pending', status: 'pending' },
  ],
};

test('currentTask returns the in-progress task from a 3-done/1-in-progress/3-pending status', async () => {
  const { tmpDir } = await makeFixture(SEVEN_TASK_FIXTURE);
  const task = await currentTask('demo', { controlRoot: tmpDir });
  assert.ok(task, 'expected a task');
  assert.equal(task.id, 't4');
  assert.equal(task.status, 'in-progress');
});

test('nextPendingTask skips past in-progress and returns the first pending task', async () => {
  const { tmpDir } = await makeFixture(SEVEN_TASK_FIXTURE);
  const task = await nextPendingTask('demo', { controlRoot: tmpDir });
  assert.ok(task, 'expected a task');
  assert.equal(task.id, 't5');
  assert.equal(task.status, 'pending');
});

test('currentTask falls back to first pending when no task is in-progress', async () => {
  const { tmpDir } = await makeFixture({
    feature: 'Demo',
    slug: 'demo',
    tasks: [
      { id: 'a', status: 'done' },
      { id: 'b', status: 'pending' },
      { id: 'c', status: 'pending' },
    ],
  });
  const task = await currentTask('demo', { controlRoot: tmpDir });
  assert.ok(task);
  assert.equal(task.id, 'b');
});

test('missing status.json: both helpers return null (no throw)', async () => {
  const { tmpDir } = await makeFixture(undefined);
  assert.equal(await currentTask('demo', { controlRoot: tmpDir }), null);
  assert.equal(await nextPendingTask('demo', { controlRoot: tmpDir }), null);
});

test('empty tasks array: both helpers return null', async () => {
  const { tmpDir } = await makeFixture({ feature: 'Demo', slug: 'demo', tasks: [] });
  assert.equal(await currentTask('demo', { controlRoot: tmpDir }), null);
  assert.equal(await nextPendingTask('demo', { controlRoot: tmpDir }), null);
});

test('tasks array missing entirely: both helpers return null', async () => {
  const { tmpDir } = await makeFixture({ feature: 'Demo', slug: 'demo' });
  assert.equal(await currentTask('demo', { controlRoot: tmpDir }), null);
  assert.equal(await nextPendingTask('demo', { controlRoot: tmpDir }), null);
});

test('all tasks done: both helpers return null', async () => {
  const { tmpDir } = await makeFixture({
    feature: 'Demo',
    slug: 'demo',
    tasks: [
      { id: 'a', status: 'done' },
      { id: 'b', status: 'done' },
      { id: 'c', status: 'done' },
    ],
  });
  assert.equal(await currentTask('demo', { controlRoot: tmpDir }), null);
  assert.equal(await nextPendingTask('demo', { controlRoot: tmpDir }), null);
});

test('corrupt status.json: both helpers return null (graceful)', async () => {
  const { tmpDir } = await makeFixture('not-valid-json{{{');
  assert.equal(await currentTask('demo', { controlRoot: tmpDir }), null);
  assert.equal(await nextPendingTask('demo', { controlRoot: tmpDir }), null);
});

test('sample-project integration: currentTask("progress-tracker") returns the t4 viewmodel task', async () => {
  const task = await currentTask('progress-tracker', { controlRoot: sampleProjectRoot });
  assert.ok(task, 'expected a task from the sample project');
  assert.equal(task.id, 't4');
  assert.equal(task.status, 'in-progress');
  assert.match(task.title, /progress\.viewmodel\.ts/);
});

test('throws if slug is missing or not a string', async () => {
  await assert.rejects(() => currentTask(''), /slug must be a non-empty string/);
  await assert.rejects(() => currentTask(null), /slug must be a non-empty string/);
  await assert.rejects(() => nextPendingTask(undefined), /slug must be a non-empty string/);
});
