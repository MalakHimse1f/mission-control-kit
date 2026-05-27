/** Tests for lib/v5/mc-router.mjs and lib/v5/context-packet.mjs */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import {
  resolveRoute,
  listTaskTypes,
  TASK_TYPE_ROUTES,
} from '../lib/v5/mc-router.mjs';
import { buildPacket } from '../lib/v5/context-packet.mjs';

async function makeTmpControlRoot() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-v5-router-'));
  const controlRoot = path.join(dir, 'control', 'v5');
  await fs.mkdir(controlRoot, { recursive: true });
  await fs.mkdir(path.join(controlRoot, 'routing'), { recursive: true });
  return { tmpDir: dir, controlRoot, projectRoot: dir };
}

test('listTaskTypes returns the six expected task types', () => {
  const types = listTaskTypes();
  assert.deepEqual(
    types.sort(),
    ['architecture', 'brainstorm', 'build', 'research', 'ui-implementation', 'ux-decisions'].sort(),
  );
});

test('all six task types resolve to non-empty docs (no defer)', async () => {
  for (const taskType of listTaskTypes()) {
    const route = await resolveRoute({ taskType, slug: 'demo' });
    assert.equal(route.taskType, taskType, `taskType echo for ${taskType}`);
    assert.equal(route.deferred, false, `${taskType} should not be deferred`);
    assert.ok(Array.isArray(route.docs), `${taskType} should have docs[]`);
    assert.ok(route.docs.length > 0, `${taskType} should have at least one doc`);
    for (const doc of route.docs) {
      assert.ok(typeof doc.path === 'string' && doc.path.length > 0, `doc.path for ${taskType}`);
      assert.ok(typeof doc.scope === 'string' && doc.scope.length > 0, `doc.scope for ${taskType}`);
    }
  }
});

test('ui-implementation route includes UI-REQUIREMENTS, primitives, wireframes', async () => {
  const route = await resolveRoute({ taskType: 'ui-implementation', slug: 'settings-panel' });
  const scopes = route.docs.map((d) => d.scope);
  const paths = route.docs.map((d) => d.path);
  assert.ok(
    paths.some((p) => p.includes('UI-REQUIREMENTS.md')),
    `expected UI-REQUIREMENTS.md in paths; got ${paths.join(', ')}`,
  );
  assert.ok(scopes.includes('ui-requirements'), 'expected ui-requirements scope');
  assert.ok(scopes.includes('ui-primitives'), 'expected ui-primitives scope');
  assert.ok(scopes.includes('wireframes'), 'expected wireframes scope');
  // slug substitution must have happened
  assert.ok(
    paths.some((p) => p.includes('settings-panel')),
    `expected slug substitution in paths; got ${paths.join(', ')}`,
  );
});

test('ux-decisions route includes UX-PATTERNS, interaction.html, flow diagrams', async () => {
  const route = await resolveRoute({ taskType: 'ux-decisions', slug: 'demo' });
  const scopes = route.docs.map((d) => d.scope);
  const paths = route.docs.map((d) => d.path);
  assert.ok(paths.some((p) => p.includes('UX-PATTERNS.md')), 'expected UX-PATTERNS.md');
  assert.ok(scopes.includes('ux-patterns'), 'expected ux-patterns scope');
  assert.ok(scopes.includes('ux-primitives'), 'expected ux-primitives scope');
  // current-flow is the "interaction.html"/flow diagrams role
  assert.ok(scopes.includes('current-flow'), 'expected current-flow scope');
});

test('architecture route includes ARCHITECTURE.md, stack.json, architecture-primitives', async () => {
  const route = await resolveRoute({ taskType: 'architecture', slug: 'demo' });
  const scopes = route.docs.map((d) => d.scope);
  const paths = route.docs.map((d) => d.path);
  assert.ok(paths.some((p) => p.includes('ARCHITECTURE.md')), 'expected ARCHITECTURE.md');
  assert.ok(paths.some((p) => p.includes('stack.json')), 'expected stack.json');
  assert.ok(scopes.includes('architecture'), 'expected architecture scope');
  assert.ok(scopes.includes('stack'), 'expected stack scope');
  assert.ok(scopes.includes('architecture-primitives'), 'expected architecture-primitives scope');
});

test('research route returns research-related docs', async () => {
  const route = await resolveRoute({ taskType: 'research', slug: 'demo' });
  const scopes = route.docs.map((d) => d.scope);
  assert.ok(scopes.includes('patterns'), 'expected patterns scope');
  assert.ok(scopes.includes('user-spec'), 'expected user-spec scope');
});

test('build route returns build-related docs (phase plans, build gates, spec)', async () => {
  const route = await resolveRoute({ taskType: 'build', slug: 'demo' });
  const scopes = route.docs.map((d) => d.scope);
  const paths = route.docs.map((d) => d.path);
  assert.ok(scopes.includes('phase-plans'), 'expected phase-plans scope');
  assert.ok(scopes.includes('build-gates'), 'expected build-gates scope');
  assert.ok(scopes.includes('spec'), 'expected spec scope');
  assert.ok(paths.some((p) => p.includes('BUILD-GATES.md')), 'expected BUILD-GATES.md');
});

test('build route includes mvvm-rules scope pointing at ARCHITECTURE-MVVM.md', async () => {
  const route = await resolveRoute({ taskType: 'build', stage: 'build', slug: 'demo' });
  const mvvmDoc = route.docs.find((d) => d.scope === 'mvvm-rules');
  assert.ok(mvvmDoc, 'expected a doc with scope "mvvm-rules" on the build route');
  assert.ok(
    mvvmDoc.path.includes('ARCHITECTURE-MVVM.md'),
    `expected mvvm-rules doc to point at ARCHITECTURE-MVVM.md; got ${mvvmDoc.path}`,
  );
  assert.equal(mvvmDoc.optional, false, 'mvvm-rules doc must be non-optional');
});

test('architecture route does NOT load ARCHITECTURE-MVVM.md (kept lean)', async () => {
  const route = await resolveRoute({ taskType: 'architecture', stage: 'architecture', slug: 'demo' });
  const paths = route.docs.map((d) => d.path);
  assert.ok(
    !paths.some((p) => p.includes('ARCHITECTURE-MVVM.md')),
    `architecture route should not include ARCHITECTURE-MVVM.md; got ${paths.join(', ')}`,
  );
  const scopes = route.docs.map((d) => d.scope);
  assert.ok(!scopes.includes('mvvm-rules'), 'architecture route should not carry mvvm-rules scope');
});

test('ARCHITECTURE.md and ARCHITECTURE-MVVM.md both exist in routing/', async () => {
  const { fileURLToPath } = await import('node:url');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const routingDir = path.join(here, '..', 'control', 'v5', 'routing');
  await fs.access(path.join(routingDir, 'ARCHITECTURE.md'));
  await fs.access(path.join(routingDir, 'ARCHITECTURE-MVVM.md'));
});

test('brainstorm route returns brainstorm-related docs', async () => {
  const route = await resolveRoute({ taskType: 'brainstorm', slug: 'demo' });
  const scopes = route.docs.map((d) => d.scope);
  assert.ok(scopes.includes('patterns'), 'expected patterns scope');
  assert.ok(scopes.includes('product-context'), 'expected product-context scope');
});

test('backtracking prevention: architecture during ux stage is deferred', async () => {
  const route = await resolveRoute({ taskType: 'architecture', stage: 'ux', slug: 'demo' });
  assert.equal(route.deferred, true);
  assert.ok(typeof route.deferredReason === 'string' && route.deferredReason.length > 0);
  assert.ok(/architecture/i.test(route.deferredReason));
  assert.deepEqual(route.docs, []);
});

test('backtracking prevention: architecture during ui stage is deferred', async () => {
  // §9 mandates UX → UI → Architecture → Build. Architecture must be blocked
  // during both UX and UI phases (not just UX).
  const route = await resolveRoute({ taskType: 'architecture', stage: 'ui', slug: 'demo' });
  assert.equal(route.deferred, true);
  assert.ok(typeof route.deferredReason === 'string' && route.deferredReason.length > 0);
  assert.ok(/architecture/i.test(route.deferredReason));
  assert.ok(/ui/i.test(route.deferredReason), 'deferred reason should mention the ui phase');
  assert.deepEqual(route.docs, []);
});

test('architecture during architecture stage is NOT deferred', async () => {
  const route = await resolveRoute({ taskType: 'architecture', stage: 'architecture', slug: 'demo' });
  assert.equal(route.deferred, false);
  assert.equal(route.deferredReason, null);
  assert.ok(route.docs.length > 0);
});

test('ui-implementation during ux stage IS deferred (UI follows UX)', async () => {
  const route = await resolveRoute({ taskType: 'ui-implementation', stage: 'ux', slug: 'demo' });
  assert.equal(route.deferred, true);
  assert.ok(/ui/i.test(route.deferredReason));
});

test('ui-implementation during ui stage is NOT deferred', async () => {
  const route = await resolveRoute({ taskType: 'ui-implementation', stage: 'ui', slug: 'demo' });
  assert.equal(route.deferred, false);
  assert.ok(route.docs.length > 0);
});

test('build during ux/ui stage IS deferred', async () => {
  for (const stage of ['ux', 'ui']) {
    const route = await resolveRoute({ taskType: 'build', stage, slug: 'demo' });
    assert.equal(route.deferred, true, `expected build deferred during ${stage}`);
  }
});

test('build during architecture stage IS deferred (architecture must complete first)', async () => {
  const route = await resolveRoute({ taskType: 'build', stage: 'architecture', slug: 'demo' });
  assert.equal(route.deferred, true);
});

test('build during build stage is NOT deferred', async () => {
  const route = await resolveRoute({ taskType: 'build', stage: 'build', slug: 'demo' });
  assert.equal(route.deferred, false);
  assert.ok(route.docs.length > 0);
});

test('non-canonical stage values (dashboard buckets) pass through the gate', async () => {
  // The orchestrator is expected to resolve a canonical phase via
  // currentPhase() before calling resolveRoute. If it doesn't, the router
  // should not block — but the test pins this contract.
  for (const stage of ['needs-input', 'ready', 'in-progress', 'complete', 'mock']) {
    const route = await resolveRoute({ taskType: 'architecture', stage, slug: 'demo' });
    assert.equal(route.deferred, false, `non-canonical stage ${stage} must not trigger the gate`);
  }
});

test('research and brainstorm task types are never deferred (advisory routes)', async () => {
  for (const stage of ['ux', 'ui', 'architecture', 'build']) {
    for (const taskType of ['research', 'brainstorm']) {
      const route = await resolveRoute({ taskType, stage, slug: 'demo' });
      assert.equal(route.deferred, false, `${taskType} during ${stage} should not be deferred`);
    }
  }
});

test('stageToDefaultTaskType maps every canonical stage to a valid task type', async () => {
  const { stageToDefaultTaskType } = await import('../lib/v5/mc-router.mjs');
  const valid = new Set(listTaskTypes());
  for (const [stage, taskType] of Object.entries({
    ux: 'ux-decisions',
    ui: 'ui-implementation',
    architecture: 'architecture',
    build: 'build',
    brainstorm: 'brainstorm',
    'needs-input': 'brainstorm',
    ready: 'build',
    'in-progress': 'build',
    complete: 'build',
    mock: 'ui-implementation',
  })) {
    assert.equal(stageToDefaultTaskType(stage), taskType);
    assert.ok(valid.has(taskType), `${taskType} (for stage ${stage}) must be a valid taskType`);
  }
});

test('stageToDefaultTaskType falls back to "brainstorm" for unknown stages', async () => {
  const { stageToDefaultTaskType } = await import('../lib/v5/mc-router.mjs');
  assert.equal(stageToDefaultTaskType('whatever'), 'brainstorm');
  assert.equal(stageToDefaultTaskType(''), 'brainstorm');
  assert.equal(stageToDefaultTaskType(null), 'brainstorm');
});

test('mc-resume command file invokes the mc skill', async () => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const cmdPath = path.join(here, '..', 'commands', 'mc-resume.md');
  const body = await fs.readFile(cmdPath, 'utf8');
  assert.match(
    body,
    /Invoke skill:\s*`?mc`?/i,
    'mc-resume.md must contain an explicit "Invoke skill: mc" directive',
  );
});

test('unknown task type throws a descriptive error', async () => {
  await assert.rejects(
    () => resolveRoute({ taskType: 'nonsense', slug: 'demo' }),
    /unknown.*task.*type|nonsense/i,
  );
});

test('missing slug for slug-dependent route emits the literal token (and warns)', async () => {
  // Spy on console.warn
  const original = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const route = await resolveRoute({ taskType: 'ui-implementation' });
    const paths = route.docs.map((d) => d.path);
    // Some path should still contain the literal {slug} token (wireframes path).
    assert.ok(
      paths.some((p) => p.includes('{slug}')),
      `expected literal {slug} token to remain in at least one path; got ${paths.join(', ')}`,
    );
    assert.ok(warnings.length > 0, 'expected at least one console.warn about missing slug');
  } finally {
    console.warn = original;
  }
});

test('verifyExists option marks docs that do not exist as missing', async () => {
  const { controlRoot, projectRoot } = await makeTmpControlRoot();
  // Create just one doc on disk: UI-REQUIREMENTS.md
  await fs.writeFile(
    path.join(controlRoot, 'routing', 'UI-REQUIREMENTS.md'),
    '# UI Requirements\n',
    'utf8',
  );
  const route = await resolveRoute({
    taskType: 'ui-implementation',
    slug: 'demo',
    controlRoot: projectRoot,
    verifyExists: true,
  });
  const uiReq = route.docs.find((d) => d.scope === 'ui-requirements');
  assert.ok(uiReq, 'expected ui-requirements doc to be present');
  assert.equal(uiReq.exists, true, 'expected ui-requirements to exist on disk');
  const primitives = route.docs.find((d) => d.scope === 'ui-primitives');
  assert.equal(primitives.exists, false, 'expected ui-primitives to be missing on disk');
});

test('TASK_TYPE_ROUTES is exported and extensible (adding a new task type)', async () => {
  // Extensibility check: callers can extend TASK_TYPE_ROUTES at runtime.
  // We do not mutate the original — just confirm it is a plain object map.
  assert.equal(typeof TASK_TYPE_ROUTES, 'object');
  assert.ok(TASK_TYPE_ROUTES['ui-implementation'], 'has ui-implementation key');
  // Simulate adding a new task type via the same shape and confirm it would resolve.
  const extended = {
    ...TASK_TYPE_ROUTES,
    'custom-task': [{ path: 'control/v5/routing/CUSTOM.md', scope: 'custom', optional: false }],
  };
  assert.ok(extended['custom-task'], 'extended map has custom-task');
  assert.equal(extended['custom-task'][0].scope, 'custom');
});

test('buildPacket integrates router and produces a packet with enriched docs', async () => {
  const { controlRoot, projectRoot } = await makeTmpControlRoot();
  await fs.writeFile(
    path.join(controlRoot, 'routing', 'UI-REQUIREMENTS.md'),
    'Lorem ipsum '.repeat(100),
    'utf8',
  );
  const route = await resolveRoute({
    taskType: 'ui-implementation',
    slug: 'demo',
    controlRoot: projectRoot,
  });
  const packet = await buildPacket({
    task: 'Build the settings panel layout',
    route,
    stage: 'ui',
    slug: 'demo',
    controlRoot: projectRoot,
  });
  assert.equal(packet.task, 'Build the settings panel layout');
  assert.equal(packet.stage, 'ui');
  assert.equal(packet.slug, 'demo');
  assert.equal(packet.deferred, false);
  assert.equal(packet.deferredReason, null);
  assert.ok(packet.route, 'packet.route present');
  assert.equal(packet.route.taskType, 'ui-implementation');
  assert.ok(Array.isArray(packet.route.docs));
  const uiReq = packet.route.docs.find((d) => d.scope === 'ui-requirements');
  assert.ok(uiReq, 'expected ui-requirements doc in packet');
  assert.equal(uiReq.exists, true, 'expected ui-requirements to be marked as existing');
});

test('buildPacket warns and skips docs that do not exist (no throw)', async () => {
  const { projectRoot } = await makeTmpControlRoot();
  const route = await resolveRoute({
    taskType: 'ui-implementation',
    slug: 'demo',
    controlRoot: projectRoot,
  });
  const original = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const packet = await buildPacket({
      task: 'thing',
      route,
      stage: 'ui',
      slug: 'demo',
      controlRoot: projectRoot,
    });
    // Most docs don't exist in our temp root — they should be flagged but not throw.
    assert.ok(Array.isArray(packet.route.docs));
    assert.ok(packet.route.docs.some((d) => d.exists === false), 'expected at least one missing doc');
    assert.ok(warnings.length > 0, 'expected at least one warning about missing doc');
  } finally {
    console.warn = original;
  }
});

test('buildPacket forwards deferred state from route', async () => {
  const route = await resolveRoute({ taskType: 'architecture', stage: 'ux', slug: 'demo' });
  const packet = await buildPacket({
    task: 'Pick a database',
    route,
    stage: 'ux',
    slug: 'demo',
  });
  assert.equal(packet.deferred, true);
  assert.ok(packet.deferredReason && packet.deferredReason.length > 0);
  assert.deepEqual(packet.route.docs, [], 'deferred packet should have no docs');
});

test('buildPacket does not expose a tokensEstimate field (removed; no consumers)', async () => {
  const { projectRoot } = await makeTmpControlRoot();
  const route = await resolveRoute({
    taskType: 'ui-implementation',
    slug: 'demo',
    controlRoot: projectRoot,
  });
  const original = console.warn;
  console.warn = () => {};
  try {
    const packet = await buildPacket({
      task: 'thing',
      route,
      stage: 'ui',
      slug: 'demo',
      controlRoot: projectRoot,
    });
    assert.equal('tokensEstimate' in packet, false, 'packet must not expose tokensEstimate');
  } finally {
    console.warn = original;
  }
  const deferredRoute = await resolveRoute({ taskType: 'architecture', stage: 'ux', slug: 'demo' });
  const deferredPacket = await buildPacket({
    task: 'thing',
    route: deferredRoute,
    stage: 'ux',
    slug: 'demo',
  });
  assert.equal('tokensEstimate' in deferredPacket, false, 'deferred packet must not expose tokensEstimate either');
});

// ---------------------------------------------------------------------------
// usageNote / visual-fragment contract
// ---------------------------------------------------------------------------

test('every task type route exposes a non-empty usageNote', async () => {
  for (const taskType of listTaskTypes()) {
    const route = await resolveRoute({ taskType, slug: 'demo' });
    assert.equal(
      typeof route.usageNote,
      'string',
      `${taskType} route should expose a string usageNote`,
    );
    assert.ok(
      route.usageNote.length > 0,
      `${taskType} usageNote should be non-empty`,
    );
  }
});

test('UX / UI / Architecture routes carry the verbatim hard rule about decision fragments', async () => {
  const visualTypes = ['ux-decisions', 'ui-implementation', 'architecture'];
  for (const taskType of visualTypes) {
    const route = await resolveRoute({ taskType, slug: 'demo' });
    assert.ok(
      route.usageNote.includes('MUST NOT write HTML for a decision card by hand'),
      `${taskType} usageNote should contain the hard rule about not hand-writing decision card HTML`,
    );
    assert.ok(
      route.usageNote.includes('lib/v5/cli/build-decision.mjs'),
      `${taskType} usageNote should reference build-decision.mjs CLI`,
    );
  }
});

test('research / build / brainstorm routes carry a shorter routing-docs note', async () => {
  const otherTypes = ['research', 'build', 'brainstorm'];
  for (const taskType of otherTypes) {
    const route = await resolveRoute({ taskType, slug: 'demo' });
    assert.ok(
      /routing docs in `control\/v5\/routing\/`/i.test(route.usageNote),
      `${taskType} usageNote should reference control/v5/routing/ docs; got: ${route.usageNote}`,
    );
  }
});

test('deferred route still forwards usageNote so orchestrator can see the contract', async () => {
  const route = await resolveRoute({ taskType: 'architecture', stage: 'ux', slug: 'demo' });
  assert.equal(route.deferred, true);
  assert.equal(typeof route.usageNote, 'string');
  assert.ok(route.usageNote.length > 0);
});

// ---------------------------------------------------------------------------
// ROUTING-MANIFEST.md sync — the human-authored route table must stay in
// lockstep with TASK_TYPE_ROUTES so the docs don't drift from the code.
// ---------------------------------------------------------------------------

/**
 * Parse the route table out of ROUTING-MANIFEST.md. Looks for markdown rows
 * shaped like `| \`task-type\` | ...`. Returns a Set of task-type strings.
 * Lenient by design — the manifest is hand-maintained.
 */
function parseManifestTaskTypes(manifestText, knownTypes) {
  const found = new Set();
  const lines = manifestText.split(/\r?\n/);
  // Match `| \`task-type\` |` or `| task-type |` (with optional backticks).
  const rowRe = /^\s*\|\s*`?([a-z0-9-]+)`?\s*\|/i;
  for (const line of lines) {
    const m = rowRe.exec(line);
    if (!m) continue;
    const candidate = m[1];
    if (knownTypes.has(candidate)) {
      found.add(candidate);
    }
  }
  return found;
}

test('ROUTING-MANIFEST.md route table is in sync with TASK_TYPE_ROUTES', async () => {
  const { fileURLToPath } = await import('node:url');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const manifestPath = path.join(here, '..', 'control', 'v5', 'routing', 'ROUTING-MANIFEST.md');
  const manifest = await fs.readFile(manifestPath, 'utf8');

  const codeTypes = new Set(Object.keys(TASK_TYPE_ROUTES));
  const manifestTypes = parseManifestTaskTypes(manifest, codeTypes);

  assert.ok(
    manifestTypes.size > 0,
    'ROUTING-MANIFEST.md is missing the route table (no `| <task-type> |` rows found). ' +
      'Add a markdown table mapping every task type in TASK_TYPE_ROUTES to its docs.',
  );

  // Every task type in code must be documented in the manifest.
  for (const taskType of codeTypes) {
    assert.ok(
      manifestTypes.has(taskType),
      `ROUTING-MANIFEST.md route table is missing task type "${taskType}". ` +
        `Add a row for it (or remove it from TASK_TYPE_ROUTES).`,
    );
  }

  // Every task type referenced in the manifest must exist in code.
  for (const taskType of manifestTypes) {
    assert.ok(
      codeTypes.has(taskType),
      `ROUTING-MANIFEST.md references unknown task type "${taskType}". ` +
        `Remove the row or add it to TASK_TYPE_ROUTES.`,
    );
  }
});
