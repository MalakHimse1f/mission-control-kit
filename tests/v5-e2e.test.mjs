/**
 * End-to-end smoke test for the Mission Control Kit v5 refactor.
 *
 * Validates the full v5 pipeline against the sample-project fixtures:
 *   1. Dashboard server boots against the sample-project's control/v5.
 *   2. GET /api/v5/features returns the 4 sample features.
 *   3. GET / renders the dashboard with all expected section labels and slugs.
 *   4. GET /feature/personal-library-import renders the feature page with
 *      tabs, cards, and the save bar.
 *   5. POST /api/v5/decisions/personal-library-import persists a changed
 *      architecture decision selection.
 *   6. GET /api/v5/decisions/personal-library-import returns the new selection.
 *   7. Re-GET /feature/personal-library-import shows the new selection on the
 *      .selected option card.
 *
 * The sample-project's on-disk fixtures are NOT mutated — the test copies
 * sample-project/control/v5/ to a tmpdir before booting the server.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { startServer } from '../control/scripts/v5/dashboard-server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SAMPLE_V5 = path.join(REPO_ROOT, 'sample-project', 'control', 'v5');
const DIAGRAMS_ROOT = path.join(REPO_ROOT, 'control', 'layout', 'diagrams');

/**
 * Copy sample-project/control/v5 to a fresh tmpdir and return the path to the
 * copied v5 root. Also returns a checksum of the original
 * personal-library-import decisions.json so the test can assert the fixture
 * is unchanged.
 */
async function makeFixtureCopy() {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mck-v5-e2e-'));
  const controlRoot = path.join(tmpRoot, 'control', 'v5');
  await fs.cp(SAMPLE_V5, controlRoot, { recursive: true });
  // Snapshot the original sample-project decisions.json so we can verify
  // (defense in depth) it was not mutated even though the server points at
  // the tmpdir copy.
  const originalDecisionsPath = path.join(
    SAMPLE_V5,
    'features',
    'personal-library-import',
    'decisions.json',
  );
  const originalDecisions = await fs.readFile(originalDecisionsPath, 'utf8');
  return {
    tmpRoot,
    controlRoot,
    originalDecisionsPath,
    originalDecisions,
  };
}

test('v5 end-to-end smoke test against sample-project fixtures', async (t) => {
  const fixture = await makeFixtureCopy();
  const handle = await startServer({
    controlRoot: fixture.controlRoot,
    diagramsRoot: DIAGRAMS_ROOT,
    port: 0,
  });

  t.after(async () => {
    try {
      await handle.close();
    } catch {
      // best-effort
    }
    // Verify the real sample-project fixture is untouched.
    const after = await fs.readFile(fixture.originalDecisionsPath, 'utf8');
    assert.equal(
      after,
      fixture.originalDecisions,
      'sample-project decisions.json must not be mutated by the e2e test',
    );
    await fs.rm(fixture.tmpRoot, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Step 2: GET /api/v5/features → array of 4 with { slug, stage, currentPhase }
  // -------------------------------------------------------------------------
  await t.test('GET /api/v5/features returns all four sample features', async () => {
    const res = await fetch(`${handle.url}/api/v5/features`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body), 'features response should be an array');
    assert.equal(body.length, 4, `expected 4 features, got ${body.length}`);

    const slugs = body.map((f) => f.slug).sort();
    assert.deepEqual(slugs, [
      'backlog-prioritization',
      'cross-media-search',
      'personal-library-import',
      'progress-tracker',
    ]);

    for (const feature of body) {
      assert.ok(
        typeof feature.slug === 'string' && feature.slug.length > 0,
        `feature has slug: ${JSON.stringify(feature)}`,
      );
      assert.ok(
        'stage' in feature,
        `feature has stage key: ${JSON.stringify(feature)}`,
      );
      // The server reports per-phase status under `phases`, which is what the
      // dashboard treats as the current/per-phase status. Task spec calls this
      // "currentPhase shape"; the server's canonical field is `phases`.
      assert.ok(
        'phases' in feature,
        `feature has phases key (currentPhase shape): ${JSON.stringify(feature)}`,
      );
    }
  });

  // -------------------------------------------------------------------------
  // Step 3: GET / → dashboard HTML with all expected labels and slugs
  // -------------------------------------------------------------------------
  await t.test('GET / renders dashboard with all sections and feature slugs', async () => {
    const res = await fetch(`${handle.url}/`);
    assert.equal(res.status, 200);
    const ct = res.headers.get('content-type') || '';
    assert.ok(ct.includes('text/html'), `expected text/html, got: ${ct}`);
    const html = await res.text();

    for (const label of [
      'Live Agents',
      'Up Next',
      'All Items',
      'Needs Your Input',
      'Ready',
      'In Progress',
      'Complete',
    ]) {
      assert.ok(html.includes(label), `expected dashboard to include "${label}"`);
    }

    for (const slug of [
      'personal-library-import',
      'backlog-prioritization',
      'progress-tracker',
      'cross-media-search',
    ]) {
      assert.ok(html.includes(slug), `expected dashboard to include slug "${slug}"`);
    }
  });

  // -------------------------------------------------------------------------
  // Step 4: GET /feature/personal-library-import → feature detail HTML
  // -------------------------------------------------------------------------
  await t.test('GET /feature/personal-library-import renders feature page with tabs and save bar', async () => {
    const res = await fetch(`${handle.url}/feature/personal-library-import`);
    assert.equal(res.status, 200);
    const ct = res.headers.get('content-type') || '';
    assert.ok(ct.includes('text/html'), `expected text/html, got: ${ct}`);
    const html = await res.text();

    assert.ok(html.includes('Personal Library Import'), 'expected feature name');

    // Three tab labels (the tabs are rendered with data-tab attributes).
    assert.ok(/data-tab="ux"/.test(html), 'expected UX tab');
    assert.ok(/data-tab="ui"/.test(html), 'expected UI tab');
    assert.ok(/data-tab="architecture"/.test(html), 'expected Architecture tab');
    assert.ok(html.includes('UX'), 'expected UX label');
    assert.ok(html.includes('UI'), 'expected UI label');
    assert.ok(html.includes('Architecture'), 'expected Architecture label');

    // At least one decision card.
    assert.ok(
      /class="option-card[^"]*"/.test(html),
      'expected at least one option-card decision card',
    );

    // Save All Decisions button.
    assert.ok(html.includes('Save All Decisions'), 'expected Save All Decisions button');
  });

  // -------------------------------------------------------------------------
  // Step 5 + 6: POST a changed architecture selection, GET to confirm.
  // -------------------------------------------------------------------------
  const NEW_ARCH_SELECTION = 'User pastes a long-lived API token';
  await t.test('POST /api/v5/decisions/personal-library-import persists a new architecture selection', async () => {
    // Start from the current saved decisions to preserve all other fields.
    const currentRes = await fetch(`${handle.url}/api/v5/decisions/personal-library-import`);
    assert.equal(currentRes.status, 200);
    const current = await currentRes.json();

    // Sanity: starting selection is the OAuth-redirect option.
    const archDecisionsBefore = current.phases.architecture.decisions;
    assert.equal(archDecisionsBefore.length, 1);
    assert.equal(archDecisionsBefore[0].id, 'arch-transport');
    assert.notEqual(
      archDecisionsBefore[0].selected,
      NEW_ARCH_SELECTION,
      'precondition: starting selection should not already equal the new one',
    );

    // Build a new payload with the changed selection.
    const updatedPayload = {
      ...current,
      phases: {
        ...current.phases,
        architecture: {
          ...current.phases.architecture,
          decisions: [
            {
              ...archDecisionsBefore[0],
              selected: NEW_ARCH_SELECTION,
              decidedAt: '2026-05-26T20:00:00.000Z',
            },
          ],
        },
      },
      updatedAt: '2026-05-26T20:00:00.000Z',
    };

    const postRes = await fetch(`${handle.url}/api/v5/decisions/personal-library-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedPayload),
    });
    const postRawText = await postRes.text();
    assert.equal(postRes.status, 200, `POST failed: ${postRawText}`);
    const postBody = JSON.parse(postRawText);
    assert.equal(postBody.feature, 'personal-library-import');
    assert.equal(
      postBody.phases.architecture.decisions[0].selected,
      NEW_ARCH_SELECTION,
      'POST response should reflect the new selection',
    );
  });

  await t.test('GET /api/v5/decisions/personal-library-import returns the persisted change', async () => {
    const res = await fetch(`${handle.url}/api/v5/decisions/personal-library-import`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(
      body.phases.architecture.decisions[0].selected,
      NEW_ARCH_SELECTION,
      'persisted decision should match the new selection',
    );
  });

  // -------------------------------------------------------------------------
  // Step 7: Re-render the feature page; .selected should move to new option.
  // -------------------------------------------------------------------------
  await t.test('GET /feature/personal-library-import reflects the new selection on the option card', async () => {
    const res = await fetch(`${handle.url}/feature/personal-library-import`);
    assert.equal(res.status, 200);
    const html = await res.text();

    const escapedValue = NEW_ARCH_SELECTION.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const selectedRe = new RegExp(
      'class="option-card selected"[^>]*data-value="' + escapedValue + '"',
    );
    assert.match(
      html,
      selectedRe,
      'expected the new selection to be rendered with class="option-card selected"',
    );
  });
});
