/**
 * v5 routing integration test.
 *
 * This is the load-bearing test that proves the pickup-prompt → router →
 * dispatch-packet chain works end-to-end without the agent guessing or
 * needing chat history.
 *
 * For every canonical phase a fresh agent could be picked up at, we verify:
 *
 *   1. `buildPickupPrompt({slug, stage})` emits a prompt that contains a
 *      concrete `taskType` value the agent can copy into a `resolveRoute`
 *      call without inference.
 *   2. Calling `resolveRoute({ taskType, stage, slug })` with exactly the
 *      taskType embedded in the prompt returns a non-empty route
 *      (or a deferred route with a clear reason — never an empty success).
 *   3. `buildPacket(...)` over that route produces an `instructions[]`
 *      array carrying the visual-fragment contract, and a `docs[]` array
 *      that resolves against the seeded sample-project fixtures.
 *
 * If this test fails, an orchestrator picking up a feature mid-flight will
 * load the wrong context — the exact bug v5 was built to prevent.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPickupPrompt } from '../lib/v5/build-pickup-prompt.mjs';
import {
  resolveRoute,
  stageToDefaultTaskType,
  listTaskTypes,
} from '../lib/v5/mc-router.mjs';
import { buildPacket } from '../lib/v5/context-packet.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(HERE, '..');
const SAMPLE_V5 = path.join(REPO_ROOT, 'sample-project', 'control', 'v5');
const PROJECT_ROOT_FOR_SAMPLE = path.join(REPO_ROOT, 'sample-project'); // contains control/v5/

/** Extract the literal taskType the prompt told the agent to use. */
function extractTaskTypeFromPrompt(prompt) {
  // Two places the prompt names the taskType:
  //   "(taskType: NAME)" and "taskType: \"NAME\""
  const m = prompt.match(/taskType:\s*"?([a-z-]+)"?/i);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Pickup prompt → resolveRoute determinism
// ---------------------------------------------------------------------------

test('pickup prompt for every canonical phase resolves to a concrete route', async () => {
  for (const stage of ['ux', 'ui', 'architecture', 'build']) {
    const prompt = buildPickupPrompt({ slug: 'demo', stage });
    const taskTypeFromPrompt = extractTaskTypeFromPrompt(prompt);
    assert.ok(
      taskTypeFromPrompt,
      `pickup prompt for stage "${stage}" did not embed a taskType:\n${prompt}`,
    );

    // The taskType the prompt told the agent to use MUST match
    // stageToDefaultTaskType — no drift.
    assert.equal(
      taskTypeFromPrompt,
      stageToDefaultTaskType(stage),
      `pickup prompt taskType ("${taskTypeFromPrompt}") drifted from stageToDefaultTaskType for ${stage}`,
    );

    // Calling the router with exactly that taskType + stage MUST succeed
    // (the default task type for the stage is, by construction, the one
    // that runs at that stage — it can never be deferred against itself).
    const route = await resolveRoute({
      taskType: taskTypeFromPrompt,
      stage,
      slug: 'demo',
    });
    assert.equal(
      route.deferred,
      false,
      `pickup-derived taskType ${taskTypeFromPrompt} should NOT be deferred during ${stage}; got: ${route.deferredReason}`,
    );
    assert.ok(
      route.docs.length > 0,
      `pickup-derived route for ${stage} produced no docs`,
    );
    assert.ok(
      route.usageNote && route.usageNote.length > 0,
      `route should carry a usageNote (visual-fragment rule) for ${stage}`,
    );
  }
});

test('pickup prompt taskType for dashboard buckets resolves cleanly', async () => {
  for (const stage of ['needs-input', 'ready', 'in-progress']) {
    const prompt = buildPickupPrompt({ slug: 'demo', stage });
    const taskType = extractTaskTypeFromPrompt(prompt);
    assert.ok(taskType, `no taskType in prompt for ${stage}`);
    // For non-canonical stages the gate is bypassed (orchestrator is expected
    // to resolve a canonical phase first), so the route should be non-empty.
    const route = await resolveRoute({ taskType, stage, slug: 'demo' });
    assert.equal(route.deferred, false);
    assert.ok(route.docs.length > 0);
  }
});

// ---------------------------------------------------------------------------
// buildPacket carries the visual-fragment rule + sane token estimate
// ---------------------------------------------------------------------------

test('buildPacket for every canonical phase produces a non-empty instructions[]', async () => {
  for (const stage of ['ux', 'ui', 'architecture', 'build']) {
    const taskType = stageToDefaultTaskType(stage);
    const route = await resolveRoute({ taskType, stage, slug: 'demo' });
    const packet = await buildPacket({
      task: `Pickup demo at stage ${stage}`,
      route,
      stage,
      slug: 'demo',
      controlRoot: PROJECT_ROOT_FOR_SAMPLE,
    });
    assert.ok(
      Array.isArray(packet.instructions) && packet.instructions.length > 0,
      `packet for ${stage} should have at least one instruction`,
    );
  }
});

test('decision-producing routes carry the visual-fragment hard rule', async () => {
  // The hard rule "MUST NOT write HTML for a decision card by hand" lives on
  // the routes that ACTUALLY produce decision artifacts (ux-decisions,
  // ui-implementation, architecture). Build / research / brainstorm get a
  // lighter advisory note. This separation is intentional — the test pins it.
  for (const taskType of ['ux-decisions', 'ui-implementation', 'architecture']) {
    const stage =
      taskType === 'ux-decisions'
        ? 'ux'
        : taskType === 'ui-implementation'
          ? 'ui'
          : 'architecture';
    const route = await resolveRoute({ taskType, stage, slug: 'demo' });
    const packet = await buildPacket({
      task: 'demo',
      route,
      stage,
      slug: 'demo',
      controlRoot: PROJECT_ROOT_FOR_SAMPLE,
    });
    const joined = packet.instructions.join('\n');
    assert.match(
      joined,
      /MUST NOT write HTML for a decision card by hand/i,
      `${taskType} packet must carry the visual-fragment hard rule`,
    );
  }
});

// ---------------------------------------------------------------------------
// Sample-project fixtures resolve cleanly through the router
// ---------------------------------------------------------------------------

test('every sample-project feature can be picked up at its currentPhase', async () => {
  const featuresDir = path.join(SAMPLE_V5, 'features');
  const slugs = (await fs.readdir(featuresDir, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  assert.ok(slugs.length > 0, 'sample-project should ship at least one feature');

  for (const slug of slugs) {
    const statusPath = path.join(featuresDir, slug, 'status.json');
    const raw = await fs.readFile(statusPath, 'utf8');
    const status = JSON.parse(raw);
    const stage = status.currentPhase || status.stage;
    assert.ok(stage, `feature ${slug} has no currentPhase or stage`);

    // The complete-stage case has no work left; skip the pickup assertion.
    if (status.stage === 'complete') continue;

    const prompt = buildPickupPrompt({ slug, stage });
    const taskType = extractTaskTypeFromPrompt(prompt);
    const route = await resolveRoute({
      taskType,
      stage,
      slug,
      controlRoot: PROJECT_ROOT_FOR_SAMPLE,
      verifyExists: true,
    });
    if (route.deferred) {
      // Deferred is acceptable as long as the reason is concrete.
      assert.ok(
        route.deferredReason && route.deferredReason.length > 0,
        `${slug} at stage ${stage} deferred with no reason`,
      );
      continue;
    }
    // For the docs the route marks as non-optional, at least the routing-doc
    // ones (UX-PATTERNS.md / UI-REQUIREMENTS.md / ARCHITECTURE.md / BUILD-GATES.md)
    // must exist on disk — they are not slug-dependent.
    const requiredRoutingDocs = route.docs.filter(
      (d) =>
        d.optional === false &&
        d.path.startsWith('control/v5/routing/'),
    );
    for (const d of requiredRoutingDocs) {
      assert.equal(
        d.exists,
        true,
        `${slug}/${stage}: required routing doc ${d.path} does not exist on disk`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Drift guards
// ---------------------------------------------------------------------------

test('every taskType in the router has a corresponding route in TASK_TYPE_ROUTES', async () => {
  const taskTypes = listTaskTypes();
  for (const t of taskTypes) {
    const route = await resolveRoute({ taskType: t, slug: 'demo' });
    assert.equal(route.taskType, t);
    assert.ok(Array.isArray(route.docs));
  }
});

test('the canonical default-task-type table is reflexive: resolveRoute(default(stage), stage) never defers', async () => {
  for (const stage of ['ux', 'ui', 'architecture', 'build']) {
    const taskType = stageToDefaultTaskType(stage);
    const route = await resolveRoute({ taskType, stage, slug: 'demo' });
    assert.equal(
      route.deferred,
      false,
      `default task type ${taskType} should not be deferred at its own stage ${stage}`,
    );
  }
});

test('decision categories in sample fixtures align with the visual-builder accepted set', async () => {
  // Catches drift between fixture authoring and the visual-builder's switch.
  const { buildVisualFragment } = await import(
    '../lib/v5/decision-visual-builder.mjs'
  );
  const featuresDir = path.join(SAMPLE_V5, 'features');
  const slugs = (await fs.readdir(featuresDir, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const slug of slugs) {
    const decisionsPath = path.join(featuresDir, slug, 'decisions.json');
    let raw;
    try {
      raw = await fs.readFile(decisionsPath, 'utf8');
    } catch {
      continue;
    }
    const data = JSON.parse(raw);
    for (const phaseKey of ['ux', 'ui', 'architecture']) {
      const phase = data.phases && data.phases[phaseKey];
      if (!phase || !Array.isArray(phase.decisions)) continue;
      for (const decision of phase.decisions) {
        // Should not throw — the builder must accept the category in fixtures.
        assert.doesNotThrow(
          () => buildVisualFragment(decision),
          `buildVisualFragment rejected ${slug}/${decision.id} (category=${decision.category})`,
        );
      }
    }
  }
});

test('parallel-execution skill references the analyzeTasks API by name', async () => {
  // Static drift guard: if analyzeTasks is renamed, the skill body falls out
  // of sync silently.
  const skillPath = path.join(
    REPO_ROOT,
    'skills',
    'mc-v5',
    'parallel-execution.md',
  );
  const body = await fs.readFile(skillPath, 'utf8');
  assert.match(
    body,
    /analyzeTasks\(/,
    'parallel-execution.md must reference analyzeTasks() so agents call the helper',
  );
});
