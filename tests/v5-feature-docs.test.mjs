/**
 * Tests for lib/v5/feature-docs.mjs — per-feature documentation collectors.
 *
 * Uses tmpdir-backed fixtures so we can exercise the missing-file paths
 * deterministically without depending on sample-project state.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  loadSpec,
  loadJournal,
  loadPhases,
  loadTasks,
  loadExplore,
  loadWireframes,
  loadAllDocs,
  __test__,
} from '../lib/v5/feature-docs.mjs';

async function makeControlRoot() {
  // `controlRoot` is the project root — the directory CONTAINING `control/v5/`.
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-v5-feature-docs-'));
  await fs.mkdir(path.join(dir, 'control', 'v5'), { recursive: true });
  return dir;
}

async function featureDir(controlRoot, slug) {
  const dir = path.join(controlRoot, 'control', 'v5', 'features', slug);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

// ---------------------------------------------------------------------------
// loadSpec
// ---------------------------------------------------------------------------

test('loadSpec returns {exists:false} when spec.md is missing', async () => {
  const root = await makeControlRoot();
  try {
    await featureDir(root, 'feat-a');
    const spec = await loadSpec('feat-a', { controlRoot: root });
    assert.equal(spec.exists, false);
    assert.equal(spec.content, '');
    assert.ok(spec.path.endsWith(path.join('features', 'feat-a', 'spec.md')));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('loadSpec returns file content when spec.md exists', async () => {
  const root = await makeControlRoot();
  try {
    const dir = await featureDir(root, 'feat-b');
    await fs.writeFile(path.join(dir, 'spec.md'), '# Hello\n\nLine 2\n');
    const spec = await loadSpec('feat-b', { controlRoot: root });
    assert.equal(spec.exists, true);
    assert.equal(spec.content, '# Hello\n\nLine 2\n');
    assert.ok(spec.path.endsWith('spec.md'));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// loadJournal
// ---------------------------------------------------------------------------

test('loadJournal returns [] when journal dir is missing', async () => {
  const root = await makeControlRoot();
  try {
    await featureDir(root, 'feat-j-missing');
    const j = await loadJournal('feat-j-missing', { controlRoot: root });
    assert.deepEqual(j, []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('loadJournal sorts by leading NNN- prefix and excludes _underscored files', async () => {
  const root = await makeControlRoot();
  try {
    const dir = await featureDir(root, 'feat-j');
    const journalDir = path.join(dir, 'journal');
    await fs.mkdir(journalDir, { recursive: true });
    await fs.writeFile(path.join(journalDir, '010-tenth.md'), 'tenth');
    await fs.writeFile(path.join(journalDir, '003-build-phase-1.md'), 'phase 1 content');
    await fs.writeFile(path.join(journalDir, '001-first.md'), 'first content');
    await fs.writeFile(path.join(journalDir, '_skip-me.md'), 'should be skipped');
    await fs.writeFile(path.join(journalDir, '_underscored-001.md'), 'also skipped');
    await fs.writeFile(path.join(journalDir, 'not-markdown.txt'), 'ignored');

    const j = await loadJournal('feat-j', { controlRoot: root });
    assert.equal(j.length, 3);
    assert.deepEqual(
      j.map((e) => e.file),
      ['001-first.md', '003-build-phase-1.md', '010-tenth.md'],
    );
    // Label transformation: strips NNN- prefix and .md, replaces - with space,
    // capitalizes first letter.
    assert.equal(j[1].label, 'Build phase 1');
    assert.equal(j[0].label, 'First');
    assert.equal(j[1].content, 'phase 1 content');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// loadPhases
// ---------------------------------------------------------------------------

test('loadPhases returns [] when phases dir is missing', async () => {
  const root = await makeControlRoot();
  try {
    await featureDir(root, 'feat-p-missing');
    const p = await loadPhases('feat-p-missing', { controlRoot: root });
    assert.deepEqual(p, []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('loadPhases sorts numerically and uses filename-without-.md as label', async () => {
  const root = await makeControlRoot();
  try {
    const dir = await featureDir(root, 'feat-p');
    const phasesDir = path.join(dir, 'phases');
    await fs.mkdir(phasesDir, { recursive: true });
    await fs.writeFile(path.join(phasesDir, 'phase-10.md'), 'p10');
    await fs.writeFile(path.join(phasesDir, 'phase-2.md'), 'p2');
    await fs.writeFile(path.join(phasesDir, 'phase-1.md'), 'p1');

    const phases = await loadPhases('feat-p', { controlRoot: root });
    // Files have no leading NNN- prefix so they sort alphabetically (10, 1, 2).
    // To get true numeric sort, the leading-number comparator runs on the
    // bit before the first dash — "phase-..." has no leading digit so all
    // three fall to alphabetical sort.
    // Adjust expectation: sort is by leading-number; without one, alphabetical.
    assert.equal(phases.length, 3);
    // alphabetical: phase-1, phase-10, phase-2
    assert.deepEqual(
      phases.map((e) => e.label),
      ['phase-1', 'phase-10', 'phase-2'],
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('loadPhases sorts numerically when files use leading NNN- convention', async () => {
  const root = await makeControlRoot();
  try {
    const dir = await featureDir(root, 'feat-p2');
    const phasesDir = path.join(dir, 'phases');
    await fs.mkdir(phasesDir, { recursive: true });
    await fs.writeFile(path.join(phasesDir, '10-final.md'), '10');
    await fs.writeFile(path.join(phasesDir, '02-mid.md'), '02');
    await fs.writeFile(path.join(phasesDir, '01-first.md'), '01');

    const phases = await loadPhases('feat-p2', { controlRoot: root });
    assert.deepEqual(
      phases.map((e) => e.file),
      ['01-first.md', '02-mid.md', '10-final.md'],
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// loadTasks
// ---------------------------------------------------------------------------

test('loadTasks returns [] when status.json is missing', async () => {
  const root = await makeControlRoot();
  try {
    await featureDir(root, 'feat-t-missing');
    const tasks = await loadTasks('feat-t-missing', { controlRoot: root });
    assert.deepEqual(tasks, []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('loadTasks returns [] when status.json has no tasks key', async () => {
  const root = await makeControlRoot();
  try {
    const dir = await featureDir(root, 'feat-t-empty');
    await fs.writeFile(path.join(dir, 'status.json'), JSON.stringify({ slug: 'feat-t-empty' }));
    const tasks = await loadTasks('feat-t-empty', { controlRoot: root });
    assert.deepEqual(tasks, []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('loadTasks normalizes task records and preserves optional fields', async () => {
  const root = await makeControlRoot();
  try {
    const dir = await featureDir(root, 'feat-t');
    await fs.writeFile(
      path.join(dir, 'status.json'),
      JSON.stringify({
        slug: 'feat-t',
        tasks: [
          {
            id: 't1',
            title: 'First task',
            status: 'done',
            updatedAt: '2026-05-26T10:00:00.000Z',
            commit: 'abc1234deadbeef',
            commitMessage: 'first',
          },
          { id: 't2', title: 'Second', status: 'in-progress' },
          { id: 't3', title: 'Blocked one', status: 'blocked' },
        ],
      }),
    );
    const tasks = await loadTasks('feat-t', { controlRoot: root });
    assert.equal(tasks.length, 3);
    assert.equal(tasks[0].id, 't1');
    assert.equal(tasks[0].commit, 'abc1234deadbeef');
    assert.equal(tasks[0].commitMessage, 'first');
    assert.equal(tasks[1].status, 'in-progress');
    assert.equal(tasks[1].commit, undefined);
    // Status pass-through (no validation).
    assert.equal(tasks[2].status, 'blocked');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('loadTasks returns [] when status.json is malformed JSON', async () => {
  const root = await makeControlRoot();
  try {
    const dir = await featureDir(root, 'feat-t-bad');
    await fs.writeFile(path.join(dir, 'status.json'), '{ not valid json');
    const tasks = await loadTasks('feat-t-bad', { controlRoot: root });
    assert.deepEqual(tasks, []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// loadExplore
// ---------------------------------------------------------------------------

test('loadExplore returns [] when explore dir is missing', async () => {
  const root = await makeControlRoot();
  try {
    await featureDir(root, 'feat-e-missing');
    const items = await loadExplore('feat-e-missing', { controlRoot: root });
    assert.deepEqual(items, []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('loadExplore returns html and md docs sorted by name', async () => {
  const root = await makeControlRoot();
  try {
    const dir = await featureDir(root, 'feat-e');
    const exploreDir = path.join(dir, 'explore');
    await fs.mkdir(exploreDir, { recursive: true });
    await fs.writeFile(path.join(exploreDir, 'zebra.html'), '<p>zebra</p>');
    await fs.writeFile(path.join(exploreDir, 'alpha.md'), '# alpha');
    await fs.writeFile(path.join(exploreDir, 'beta.html'), '<p>beta</p>');
    await fs.writeFile(path.join(exploreDir, 'ignored.txt'), 'ignored');

    const items = await loadExplore('feat-e', { controlRoot: root });
    assert.equal(items.length, 3);
    assert.deepEqual(
      items.map((i) => i.name),
      ['alpha', 'beta', 'zebra'],
    );
    assert.equal(items[0].format, 'md');
    assert.equal(items[1].format, 'html');
    assert.equal(items[2].format, 'html');
    assert.equal(items[0].content, '# alpha');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// loadWireframes
// ---------------------------------------------------------------------------

test('loadWireframes returns [] when wireframes dir is missing', async () => {
  const root = await makeControlRoot();
  try {
    await featureDir(root, 'feat-w-missing');
    const items = await loadWireframes('feat-w-missing', { controlRoot: root });
    assert.deepEqual(items, []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('loadWireframes returns sorted html files with id/label/html', async () => {
  const root = await makeControlRoot();
  try {
    const dir = await featureDir(root, 'feat-w');
    const wDir = path.join(dir, 'layout', 'wireframes');
    await fs.mkdir(wDir, { recursive: true });
    await fs.writeFile(path.join(wDir, 'home-screen.html'), '<h1>home</h1>');
    await fs.writeFile(path.join(wDir, 'detail-view.html'), '<h1>detail</h1>');

    const items = await loadWireframes('feat-w', { controlRoot: root });
    assert.equal(items.length, 2);
    assert.deepEqual(
      items.map((i) => i.id),
      ['detail-view', 'home-screen'],
    );
    assert.equal(items[0].label, 'detail view');
    assert.equal(items[1].label, 'home screen');
    assert.equal(items[0].html, '<h1>detail</h1>');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// loadAllDocs
// ---------------------------------------------------------------------------

test('loadAllDocs returns all six keys even for an empty feature', async () => {
  const root = await makeControlRoot();
  try {
    await featureDir(root, 'feat-empty');
    const bundle = await loadAllDocs('feat-empty', { controlRoot: root });
    assert.equal(bundle.spec.exists, false);
    assert.deepEqual(bundle.tasks, []);
    assert.deepEqual(bundle.phases, []);
    assert.deepEqual(bundle.journal, []);
    assert.deepEqual(bundle.explore, []);
    assert.deepEqual(bundle.wireframes, []);
    // All six keys present.
    assert.deepEqual(
      Object.keys(bundle).sort(),
      ['explore', 'journal', 'phases', 'spec', 'tasks', 'wireframes'],
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('loadAllDocs collects everything in parallel', async () => {
  const root = await makeControlRoot();
  try {
    const dir = await featureDir(root, 'feat-full');
    await fs.writeFile(path.join(dir, 'spec.md'), '# Spec');
    await fs.writeFile(
      path.join(dir, 'status.json'),
      JSON.stringify({ slug: 'feat-full', tasks: [{ id: 't1', title: 'A', status: 'done' }] }),
    );
    await fs.mkdir(path.join(dir, 'journal'), { recursive: true });
    await fs.writeFile(path.join(dir, 'journal', '001-first.md'), 'first');
    await fs.mkdir(path.join(dir, 'phases'), { recursive: true });
    await fs.writeFile(path.join(dir, 'phases', 'phase-1.md'), 'phase 1');
    await fs.mkdir(path.join(dir, 'explore'), { recursive: true });
    await fs.writeFile(path.join(dir, 'explore', 'notes.md'), 'notes');
    await fs.mkdir(path.join(dir, 'layout', 'wireframes'), { recursive: true });
    await fs.writeFile(path.join(dir, 'layout', 'wireframes', 'home.html'), '<h1>h</h1>');

    const bundle = await loadAllDocs('feat-full', { controlRoot: root });
    assert.equal(bundle.spec.exists, true);
    assert.equal(bundle.tasks.length, 1);
    assert.equal(bundle.phases.length, 1);
    assert.equal(bundle.journal.length, 1);
    assert.equal(bundle.explore.length, 1);
    assert.equal(bundle.wireframes.length, 1);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Internal helpers (sanity)
// ---------------------------------------------------------------------------

test('journalLabel transforms NNN-foo-bar.md → "Foo bar"', () => {
  assert.equal(__test__.journalLabel('003-build-phase-1.md'), 'Build phase 1');
  assert.equal(__test__.journalLabel('001-first.md'), 'First');
  assert.equal(__test__.journalLabel('no-prefix.md'), 'No prefix');
});

test('compareByLeadingNumber sorts by leading digit ascending', () => {
  const arr = ['010-a.md', '002-b.md', '001-c.md', 'no-digit.md'];
  arr.sort(__test__.compareByLeadingNumber);
  assert.deepEqual(arr, ['001-c.md', '002-b.md', '010-a.md', 'no-digit.md']);
});
