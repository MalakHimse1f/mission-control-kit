/** Tests for lib/v5/cli/build-decision.mjs */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import {
  buildDecisionFragment,
  parseArgs,
} from '../lib/v5/cli/build-decision.mjs';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CLI_PATH = path.join(REPO_ROOT, 'lib', 'v5', 'cli', 'build-decision.mjs');

const SAMPLE_DECISIONS = {
  feature: 'sample-feature',
  phases: {
    ux: {
      status: 'complete',
      decisions: [
        {
          id: 'ux-flow',
          category: 'ux',
          question: 'How should the user flow look?',
          options: [
            'Stepped wizard with explicit Next buttons',
            'Single page with inline confirmation',
            'Modal flow over the main view',
          ],
          selected: 'Stepped wizard with explicit Next buttons',
          decidedAt: '2026-05-26T10:00:00.000Z',
        },
      ],
      pending: [],
    },
    ui: {
      status: 'complete',
      decisions: [
        {
          id: 'ui-placement',
          category: 'ui',
          question: 'Where does this surface live?',
          options: [
            'Dedicated page reachable from nav',
            'Drawer overlay from the main view',
          ],
          selected: 'Dedicated page reachable from nav',
          decidedAt: '2026-05-26T11:00:00.000Z',
        },
      ],
      pending: [],
    },
    architecture: {
      status: 'in-progress',
      decisions: [
        {
          id: 'arch-store',
          category: 'engineering',
          question: 'Where do we persist the data?',
          options: [
            'SQLite — embedded, single-file, no service',
            'Postgres — managed service with migrations',
            'KV store — simple key/value lookups only',
          ],
          selected: 'SQLite — embedded, single-file, no service',
          decidedAt: '2026-05-26T12:00:00.000Z',
        },
      ],
      pending: [],
    },
  },
  deferred: [],
  updatedAt: '2026-05-26T12:00:00.000Z',
};

async function makeTmpControlRoot(slug = 'sample-feature') {
  // `controlRoot` is the project root — the directory CONTAINING `control/v5/`.
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-v5-cli-build-decision-'));
  const controlRoot = tmpDir;
  const featureDir = path.join(controlRoot, 'control', 'v5', 'features', slug);
  await fs.mkdir(featureDir, { recursive: true });
  await fs.writeFile(
    path.join(featureDir, 'decisions.json'),
    JSON.stringify(SAMPLE_DECISIONS, null, 2) + '\n',
    'utf8',
  );
  return { tmpDir, controlRoot, featureDir, slug };
}

test('writes a fragment file at the expected path', async () => {
  const { controlRoot, featureDir, slug } = await makeTmpControlRoot();
  const result = await buildDecisionFragment({
    slug,
    decisionId: 'arch-store',
    controlRoot,
  });
  // featureDir is now {controlRoot}/control/v5/features/{slug}
  const expected = path.join(featureDir, 'decisions', 'arch-store.html');
  assert.equal(result.path, expected);
  const onDisk = await fs.readFile(expected, 'utf8');
  assert.ok(onDisk.length > 0, 'fragment file should be non-empty');
  assert.equal(onDisk, result.fragment, 'returned fragment matches on-disk content');
});

test('fragment contains data-group and one mc-option-card per option', async () => {
  const { controlRoot, slug } = await makeTmpControlRoot();
  const decisionId = 'arch-store';
  const { fragment } = await buildDecisionFragment({
    slug,
    decisionId,
    controlRoot,
  });
  assert.ok(
    fragment.includes(`data-group="${decisionId}"`),
    `fragment should include data-group="${decisionId}"`,
  );
  const decision = SAMPLE_DECISIONS.phases.architecture.decisions.find(
    (d) => d.id === decisionId,
  );
  const cardCount = (fragment.match(/class="mc-option-card[^"]*"/g) || []).length;
  assert.equal(
    cardCount,
    decision.options.length,
    `expected ${decision.options.length} mc-option-card entries, got ${cardCount}`,
  );
  // Each option's data-value should be present
  for (const option of decision.options) {
    assert.ok(
      fragment.includes(`data-value="${option.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`)
        || fragment.includes(`data-value="${option}"`),
      `fragment should reference option: ${option}`,
    );
  }
});

test('finds decisions across all phases (ux, ui, architecture)', async () => {
  const { controlRoot, slug } = await makeTmpControlRoot();
  for (const id of ['ux-flow', 'ui-placement', 'arch-store']) {
    const { path: outPath, fragment } = await buildDecisionFragment({
      slug,
      decisionId: id,
      controlRoot,
    });
    assert.ok(outPath.endsWith(`${id}.html`));
    assert.ok(fragment.includes(`data-group="${id}"`));
  }
});

test('re-running is idempotent — overwrites cleanly with same content', async () => {
  const { controlRoot, slug } = await makeTmpControlRoot();
  const decisionId = 'ux-flow';
  const first = await buildDecisionFragment({ slug, decisionId, controlRoot });
  const second = await buildDecisionFragment({ slug, decisionId, controlRoot });
  assert.equal(first.path, second.path);
  assert.equal(first.fragment, second.fragment);
  const onDisk = await fs.readFile(first.path, 'utf8');
  assert.equal(onDisk, second.fragment);
});

test('missing slug (no decisions.json) rejects with clear message', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-v5-cli-missing-slug-'));
  // `controlRoot` is the project root containing `control/v5/`.
  const controlRoot = tmpDir;
  await fs.mkdir(path.join(controlRoot, 'control', 'v5'), { recursive: true });
  await assert.rejects(
    () =>
      buildDecisionFragment({
        slug: 'does-not-exist',
        decisionId: 'whatever',
        controlRoot,
      }),
    (err) => {
      assert.match(err.message, /decisions\.json not found/);
      assert.match(err.message, /does-not-exist/);
      return true;
    },
  );
});

test('missing decision id rejects with message that includes the id', async () => {
  const { controlRoot, slug } = await makeTmpControlRoot();
  await assert.rejects(
    () =>
      buildDecisionFragment({
        slug,
        decisionId: 'nope-not-real',
        controlRoot,
      }),
    (err) => {
      assert.match(err.message, /nope-not-real/);
      // Should mention available ids
      assert.match(err.message, /ux-flow/);
      return true;
    },
  );
});

test('rejects when slug arg is missing/empty', async () => {
  await assert.rejects(
    () => buildDecisionFragment({ decisionId: 'x', controlRoot: '/tmp' }),
    /slug/,
  );
  await assert.rejects(
    () => buildDecisionFragment({ slug: '', decisionId: 'x', controlRoot: '/tmp' }),
    /slug/,
  );
});

test('rejects when decisionId arg is missing/empty', async () => {
  await assert.rejects(
    () => buildDecisionFragment({ slug: 'x', controlRoot: '/tmp' }),
    /decisionId/,
  );
  await assert.rejects(
    () => buildDecisionFragment({ slug: 'x', decisionId: '', controlRoot: '/tmp' }),
    /decisionId/,
  );
});

test('parseArgs handles positional args and --control-root', () => {
  assert.deepEqual(
    parseArgs(['my-slug', 'my-id']),
    { slug: 'my-slug', decisionId: 'my-id', controlRoot: undefined },
  );
  assert.deepEqual(
    parseArgs(['my-slug', 'my-id', '--control-root', '/x/y']),
    { slug: 'my-slug', decisionId: 'my-id', controlRoot: '/x/y' },
  );
  assert.deepEqual(
    parseArgs(['--control-root=/x/y', 'my-slug', 'my-id']),
    { slug: 'my-slug', decisionId: 'my-id', controlRoot: '/x/y' },
  );
});

test('parseArgs throws on too few positional args', () => {
  assert.throws(() => parseArgs([]), /Usage:/);
  assert.throws(() => parseArgs(['only-one']), /Usage:/);
});

test('parseArgs throws on unknown flag', () => {
  assert.throws(() => parseArgs(['slug', 'id', '--bogus']), /Unknown flag/);
});

test('CLI subprocess: writes fragment and prints path on success', async () => {
  const { controlRoot, slug } = await makeTmpControlRoot();
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    CLI_PATH,
    slug,
    'ui-placement',
    '--control-root',
    controlRoot,
  ]);
  assert.equal(stderr, '');
  const expected = path.join(
    controlRoot,
    'control',
    'v5',
    'features',
    slug,
    'decisions',
    'ui-placement.html',
  );
  assert.equal(stdout.trim(), expected);
  const onDisk = await fs.readFile(expected, 'utf8');
  assert.ok(onDisk.includes('data-group="ui-placement"'));
});

test('CLI subprocess: exits 1 with stderr on unknown decision id', async () => {
  const { controlRoot, slug } = await makeTmpControlRoot();
  await assert.rejects(
    execFileAsync(process.execPath, [
      CLI_PATH,
      slug,
      'does-not-exist',
      '--control-root',
      controlRoot,
    ]),
    (err) => {
      assert.equal(err.code, 1);
      assert.match(err.stderr, /does-not-exist/);
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// v5.1 — sidecar (decisions/{id}.visual.json)
// ---------------------------------------------------------------------------

test('reads decisions/{id}.visual.json sidecar and routes per-option preset', async () => {
  const { controlRoot, featureDir, slug } = await makeTmpControlRoot();
  const decisionId = 'ux-flow';
  const decisionsDir = path.join(featureDir, 'decisions');
  await fs.mkdir(decisionsDir, { recursive: true });
  await fs.writeFile(
    path.join(decisionsDir, `${decisionId}.visual.json`),
    JSON.stringify({
      id: decisionId,
      options: {
        'Stepped wizard with explicit Next buttons': { preset: 'wizard-4step' },
        'Single page with inline confirmation': { preset: 'approval' },
        'Modal flow over the main view': { preset: 'browse-select' },
      },
    }, null, 2),
    'utf8',
  );
  const { fragment } = await buildDecisionFragment({
    slug,
    decisionId,
    controlRoot,
  });
  // Each option becomes a flow timeline from a distinct preset.
  assert.equal((fragment.match(/mc-flow-timeline/g) || []).length, 3);
  // wizard-4step ends with "Done"; approval ends with "Approve"; browse-select ends with "Apply".
  assert.match(fragment, />Done</);
  assert.match(fragment, />Approve</);
  assert.match(fragment, />Apply</);
});

test('sidecar diagram spec renders feature-specific arch nodes', async () => {
  const { controlRoot, featureDir, slug } = await makeTmpControlRoot();
  const decisionId = 'arch-store';
  const decisionsDir = path.join(featureDir, 'decisions');
  await fs.mkdir(decisionsDir, { recursive: true });
  await fs.writeFile(
    path.join(decisionsDir, `${decisionId}.visual.json`),
    JSON.stringify({
      id: decisionId,
      options: {
        'SQLite — embedded, single-file, no service': {
          diagram: {
            nodes: [
              { id: 'app', kind: 'client', label: 'App' },
              { id: 'sqlite', kind: 'db', label: 'SQLite' },
            ],
            edges: [{ from: 'app', to: 'sqlite', kind: 'data', label: 'file' }],
          },
        },
        'Postgres — managed service with migrations': {
          diagram: {
            nodes: [
              { id: 'app', kind: 'client', label: 'App' },
              { id: 'api', kind: 'service', label: 'API' },
              { id: 'pg', kind: 'db', label: 'Postgres' },
            ],
            edges: [
              { from: 'app', to: 'api', kind: 'sync' },
              { from: 'api', to: 'pg', kind: 'data' },
            ],
          },
        },
      },
    }, null, 2),
    'utf8',
  );
  const { fragment } = await buildDecisionFragment({
    slug,
    decisionId,
    controlRoot,
  });
  assert.match(fragment, />SQLite</);
  assert.match(fragment, />Postgres</);
  assert.match(fragment, />API</);
  // Each of the 3 options renders its own surface — 2 from the sidecar
  // (SQLite, Postgres) plus 1 from the legacy rotation for the
  // third option (KV store), which uses the same surface wrapper.
  assert.ok((fragment.match(/mc-diagram-surface/g) || []).length >= 2);
});

test('sidecar raw escape hatch lands verbatim in the fragment', async () => {
  const { controlRoot, featureDir, slug } = await makeTmpControlRoot();
  const decisionId = 'ui-placement';
  const decisionsDir = path.join(featureDir, 'decisions');
  await fs.mkdir(decisionsDir, { recursive: true });
  await fs.writeFile(
    path.join(decisionsDir, `${decisionId}.visual.json`),
    JSON.stringify({
      id: decisionId,
      options: {
        'Dedicated page reachable from nav': { raw: '<svg class="ad-hoc-icon"></svg>' },
      },
    }),
    'utf8',
  );
  const { fragment } = await buildDecisionFragment({
    slug,
    decisionId,
    controlRoot,
  });
  assert.match(fragment, /<svg class="ad-hoc-icon"><\/svg>/);
});

test('sidecar with malformed JSON rejects with a clear error', async () => {
  const { controlRoot, featureDir, slug } = await makeTmpControlRoot();
  const decisionId = 'arch-store';
  const decisionsDir = path.join(featureDir, 'decisions');
  await fs.mkdir(decisionsDir, { recursive: true });
  await fs.writeFile(
    path.join(decisionsDir, `${decisionId}.visual.json`),
    '{not valid json',
    'utf8',
  );
  await assert.rejects(
    buildDecisionFragment({ slug, decisionId, controlRoot }),
    /not valid JSON/i,
  );
});

test('sidecar with mismatched id rejects with a clear error', async () => {
  const { controlRoot, featureDir, slug } = await makeTmpControlRoot();
  const decisionId = 'arch-store';
  const decisionsDir = path.join(featureDir, 'decisions');
  await fs.mkdir(decisionsDir, { recursive: true });
  await fs.writeFile(
    path.join(decisionsDir, `${decisionId}.visual.json`),
    JSON.stringify({ id: 'arch-something-else', options: {} }),
    'utf8',
  );
  await assert.rejects(
    buildDecisionFragment({ slug, decisionId, controlRoot }),
    /sidecar.+id "arch-something-else".+expected "arch-store"/,
  );
});

test('missing sidecar is fine — legacy rotation still produces a fragment', async () => {
  // No sidecar file at all. This is the v5.0 path; v5.1 must not regress it.
  const { controlRoot, slug } = await makeTmpControlRoot();
  const { fragment } = await buildDecisionFragment({
    slug,
    decisionId: 'arch-store',
    controlRoot,
  });
  assert.match(fragment, /mc-diagram-surface/);
});

test('CLI subprocess: exits 1 with usage on missing args', async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [CLI_PATH]),
    (err) => {
      assert.equal(err.code, 1);
      assert.match(err.stderr, /Usage:/);
      return true;
    },
  );
});
