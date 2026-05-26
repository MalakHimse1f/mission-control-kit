/**
 * Tests for lib/v5/dependency-graph.mjs
 *
 * Validates the dependency analyzer used by the v5 orchestrator to decide
 * which tasks can be dispatched in parallel, per §11 of
 * `docs/REFACTOR-REQUIREMENTS.md`.
 *
 * Rules under test:
 *   - Two tasks touching disjoint files (and with no dependsOn) may run together.
 *   - Two tasks touching the same file must end up in different batches.
 *   - Explicit `dependsOn` forces ordering: dependents land in later batches.
 *   - Read-only tasks (files: []) can all run together.
 *   - detectFileConflicts surfaces the conflicting pair + shared files.
 *   - Cyclic dependsOn throws a clear error.
 *   - Empty input returns the empty shape.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeTasks,
  detectFileConflicts,
} from '../lib/v5/dependency-graph.mjs';

function batchIndexOf(parallel, id) {
  for (let i = 0; i < parallel.length; i += 1) {
    if (parallel[i].includes(id)) return i;
  }
  return -1;
}

test('analyzeTasks: empty input returns empty shape', () => {
  const result = analyzeTasks([]);
  assert.deepEqual(result, { parallel: [], sequential: [] });
});

test('analyzeTasks: two tasks with disjoint files and no deps → same batch', () => {
  const tasks = [
    { id: 'A', name: 'add login', files: ['src/login.ts'] },
    { id: 'B', name: 'add signup', files: ['src/signup.ts'] },
  ];
  const { parallel } = analyzeTasks(tasks);
  assert.equal(parallel.length, 1, 'expected a single parallel batch');
  assert.equal(parallel[0].length, 2);
  assert.ok(parallel[0].includes('A'));
  assert.ok(parallel[0].includes('B'));
});

test('analyzeTasks: two tasks with shared files → different batches', () => {
  const tasks = [
    { id: 'A', name: 'edit api', files: ['src/api.ts'] },
    { id: 'B', name: 'also edit api', files: ['src/api.ts'] },
  ];
  const { parallel } = analyzeTasks(tasks);
  const a = batchIndexOf(parallel, 'A');
  const b = batchIndexOf(parallel, 'B');
  assert.ok(a >= 0 && b >= 0, 'both tasks should be present');
  assert.notEqual(a, b, 'shared-file tasks must not be in the same batch');
});

test('analyzeTasks: dependsOn forces later batch for the dependent', () => {
  const tasks = [
    { id: 'A', name: 'schema', files: ['db/schema.sql'] },
    { id: 'B', name: 'uses schema', files: ['src/svc.ts'], dependsOn: ['A'] },
  ];
  const { parallel } = analyzeTasks(tasks);
  const a = batchIndexOf(parallel, 'A');
  const b = batchIndexOf(parallel, 'B');
  assert.ok(a >= 0 && b >= 0);
  assert.ok(b > a, `expected B (${b}) in a later batch than A (${a})`);
});

test('analyzeTasks: read-only tasks (files: []) all collapse into one batch', () => {
  const tasks = [
    { id: 'A', name: 'read 1', files: [] },
    { id: 'B', name: 'read 2', files: [] },
    { id: 'C', name: 'read 3', files: [] },
  ];
  const { parallel } = analyzeTasks(tasks);
  assert.equal(parallel.length, 1, 'all read-only tasks should be one batch');
  assert.equal(parallel[0].length, 3);
});

test('analyzeTasks: mixed batch — independent + dependent chain', () => {
  const tasks = [
    { id: 'A', name: 'schema', files: ['db/schema.sql'] },
    { id: 'B', name: 'unrelated', files: ['src/unrelated.ts'] },
    { id: 'C', name: 'uses A', files: ['src/svc.ts'], dependsOn: ['A'] },
  ];
  const { parallel } = analyzeTasks(tasks);
  const a = batchIndexOf(parallel, 'A');
  const b = batchIndexOf(parallel, 'B');
  const c = batchIndexOf(parallel, 'C');
  assert.equal(a, b, 'A and B should batch together (independent)');
  assert.ok(c > a, 'C should be in a later batch than A');
});

test('analyzeTasks: sequential is a flat order respecting dependsOn', () => {
  const tasks = [
    { id: 'A', name: 'schema', files: ['db/schema.sql'] },
    { id: 'B', name: 'uses A', files: ['src/svc.ts'], dependsOn: ['A'] },
    { id: 'C', name: 'uses B', files: ['src/ui.ts'], dependsOn: ['B'] },
  ];
  const { sequential } = analyzeTasks(tasks);
  assert.equal(sequential.length, 3);
  assert.ok(
    sequential.indexOf('A') < sequential.indexOf('B'),
    'A must come before B',
  );
  assert.ok(
    sequential.indexOf('B') < sequential.indexOf('C'),
    'B must come before C',
  );
});

test('analyzeTasks: throws on cyclic dependsOn', () => {
  const tasks = [
    { id: 'A', name: 'a', files: [], dependsOn: ['B'] },
    { id: 'B', name: 'b', files: [], dependsOn: ['A'] },
  ];
  assert.throws(() => analyzeTasks(tasks), /cycle|cyclic/i);
});

test('analyzeTasks: throws on self-dependency cycle', () => {
  const tasks = [{ id: 'A', name: 'a', files: [], dependsOn: ['A'] }];
  assert.throws(() => analyzeTasks(tasks), /cycle|cyclic/i);
});

test('analyzeTasks: throws on duplicate task ids', () => {
  const tasks = [
    { id: 'A', name: 'a', files: [] },
    { id: 'A', name: 'a-dup', files: [] },
  ];
  assert.throws(() => analyzeTasks(tasks), /duplicate|unique/i);
});

test('analyzeTasks: throws when dependsOn references unknown task', () => {
  const tasks = [
    { id: 'A', name: 'a', files: [], dependsOn: ['NOPE'] },
  ];
  assert.throws(() => analyzeTasks(tasks), /unknown|NOPE/);
});

test('analyzeTasks: throws on non-array input', () => {
  assert.throws(() => analyzeTasks(null), /array|tasks/i);
  assert.throws(() => analyzeTasks({}), /array|tasks/i);
});

test('detectFileConflicts: returns conflicting pair with shared files', () => {
  const tasks = [
    { id: 'A', name: 'a', files: ['src/api.ts', 'src/util.ts'] },
    { id: 'B', name: 'b', files: ['src/api.ts'] },
    { id: 'C', name: 'c', files: ['src/other.ts'] },
  ];
  const conflicts = detectFileConflicts(tasks);
  assert.equal(conflicts.length, 1, 'expected exactly one conflict pair');
  const c = conflicts[0];
  const ids = [c.taskA, c.taskB].sort();
  assert.deepEqual(ids, ['A', 'B']);
  assert.deepEqual(c.files, ['src/api.ts']);
});

test('detectFileConflicts: no conflicts returns empty array', () => {
  const tasks = [
    { id: 'A', name: 'a', files: ['src/a.ts'] },
    { id: 'B', name: 'b', files: ['src/b.ts'] },
  ];
  assert.deepEqual(detectFileConflicts(tasks), []);
});

test('detectFileConflicts: empty input returns empty array', () => {
  assert.deepEqual(detectFileConflicts([]), []);
});

test('detectFileConflicts: read-only tasks never conflict', () => {
  const tasks = [
    { id: 'A', name: 'a', files: [] },
    { id: 'B', name: 'b', files: [] },
  ];
  assert.deepEqual(detectFileConflicts(tasks), []);
});

test('detectFileConflicts: multiple shared files are listed together', () => {
  const tasks = [
    { id: 'A', name: 'a', files: ['x.ts', 'y.ts', 'z.ts'] },
    { id: 'B', name: 'b', files: ['y.ts', 'z.ts'] },
  ];
  const conflicts = detectFileConflicts(tasks);
  assert.equal(conflicts.length, 1);
  assert.deepEqual(conflicts[0].files.slice().sort(), ['y.ts', 'z.ts']);
});
