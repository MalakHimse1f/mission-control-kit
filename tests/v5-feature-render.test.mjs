/**
 * Tests for v5 feature detail rendering:
 *   - lib/v5/feature-data.mjs            (loadFeatureData)
 *   - control/scripts/v5/render-feature.mjs (renderFeature)
 *
 * Plus an end-to-end smoke test that the Task-3 dashboard server now serves
 * the real feature HTML, /feature.css, /feature-client.js, and that a POST
 * to /api/v5/decisions/:slug followed by a re-GET round-trips correctly.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { loadFeatureData } from '../lib/v5/feature-data.mjs';
import { renderFeature } from '../control/scripts/v5/render-feature.mjs';
import { startServer } from '../control/scripts/v5/dashboard-server.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
// SAMPLE_V5 is the project root that CONTAINS `control/v5/` — passed to APIs
// as `controlRoot`. (Was previously the `control/v5/` directory itself.)
const SAMPLE_V5 = path.join(REPO_ROOT, 'sample-project');

// ---------------------------------------------------------------------------
// loadFeatureData
// ---------------------------------------------------------------------------

test('loadFeatureData returns the expected shape for personal-library-import', async () => {
  const data = await loadFeatureData({
    slug: 'personal-library-import',
    controlRoot: SAMPLE_V5,
  });
  assert.equal(data.slug, 'personal-library-import');
  assert.equal(data.status.feature, 'Personal Library Import');
  assert.ok(data.decisions);
  assert.equal(data.decisions.feature, 'personal-library-import');

  // Three tabs, canonical order.
  assert.ok(data.tabs.ux);
  assert.ok(data.tabs.ui);
  assert.ok(data.tabs.architecture);
  assert.equal(data.tabs.ux.label, 'UX');
  assert.equal(data.tabs.ui.label, 'UI');
  assert.equal(data.tabs.architecture.label, 'Architecture');

  // UX/UI complete; architecture in-progress per sample fixture.
  assert.equal(data.tabs.ux.status, 'complete');
  assert.equal(data.tabs.ui.status, 'complete');
  assert.equal(data.tabs.architecture.status, 'in-progress');

  // Decisions counts.
  assert.equal(data.tabs.ux.decisions.length, 2);
  assert.equal(data.tabs.ui.decisions.length, 2);
  assert.equal(data.tabs.architecture.decisions.length, 1);
  assert.deepEqual(data.tabs.architecture.pending, ['arch-connector-pattern']);
});

test('loadFeatureData throws ENOFEATURE for a missing slug', async () => {
  await assert.rejects(
    () => loadFeatureData({ slug: 'does-not-exist', controlRoot: SAMPLE_V5 }),
    (err) => err && err.code === 'ENOFEATURE',
  );
});

test('loadFeatureData throws on missing slug or controlRoot', async () => {
  await assert.rejects(() => loadFeatureData({ controlRoot: SAMPLE_V5 }), /slug/);
  await assert.rejects(() => loadFeatureData({ slug: 'personal-library-import' }), /controlRoot/);
});

test('loadFeatureData synthesizes defaults when status.json is missing', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-v5-feature-'));
  try {
    const featureDir = path.join(tmp, 'control', 'v5', 'features', 'minimal');
    await fs.mkdir(featureDir, { recursive: true });
    // No status.json, no decisions.json.
    const data = await loadFeatureData({ slug: 'minimal', controlRoot: tmp });
    assert.equal(data.slug, 'minimal');
    assert.equal(data.status.slug, 'minimal');
    assert.equal(data.tabs.ux.status, 'not-started');
    assert.equal(data.tabs.ui.status, 'not-started');
    assert.equal(data.tabs.architecture.status, 'not-started');
    assert.deepEqual(data.tabs.ux.decisions, []);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// renderFeature
// ---------------------------------------------------------------------------

test('renderFeature contains breadcrumb, three tabs, save button', async () => {
  const data = await loadFeatureData({
    slug: 'personal-library-import',
    controlRoot: SAMPLE_V5,
  });
  const html = renderFeature({ slug: 'personal-library-import', data });

  assert.ok(
    html.startsWith('<!doctype html') || html.startsWith('<!DOCTYPE html'),
  );

  // Breadcrumb back to dashboard.
  assert.ok(html.includes('href="/"'), 'expected breadcrumb back-link to /');
  assert.ok(html.includes('Personal Library Import'), 'expected feature name in breadcrumb/header');

  // Three tab labels.
  assert.ok(/data-tab="ux"/.test(html), 'expected UX tab');
  assert.ok(/data-tab="ui"/.test(html), 'expected UI tab');
  assert.ok(/data-tab="architecture"/.test(html), 'expected Architecture tab');
  assert.ok(html.includes('>UX<') || html.includes('>UX'), 'expected UX label');
  assert.ok(html.includes('>UI<') || html.includes('>UI'), 'expected UI label');
  assert.ok(html.includes('Architecture'), 'expected Architecture label');

  // Save All Decisions button.
  assert.ok(html.includes('Save All Decisions'), 'expected save button label');
  assert.ok(/id="btn-save"/.test(html));
});

test('renderFeature includes at least one decision card per non-empty tab', async () => {
  const data = await loadFeatureData({
    slug: 'personal-library-import',
    controlRoot: SAMPLE_V5,
  });
  const html = renderFeature({ slug: 'personal-library-import', data });

  // Each decision id should appear as a data-group attribute.
  for (const phase of ['ux', 'ui', 'architecture']) {
    for (const d of data.tabs[phase].decisions) {
      assert.ok(
        html.includes(`data-group="${d.id}"`),
        `expected data-group="${d.id}" in HTML`,
      );
    }
  }
});

test('renderFeature marks the saved option with .selected for hydration', async () => {
  const data = await loadFeatureData({
    slug: 'personal-library-import',
    controlRoot: SAMPLE_V5,
  });
  const html = renderFeature({ slug: 'personal-library-import', data });

  // The architecture decision picked "OAuth redirect with per-provider client credentials".
  const arch = data.tabs.architecture.decisions[0];
  const selectedValue = arch.selected;
  const selectedFragment = `data-value="${selectedValue}"`;
  assert.ok(html.includes(selectedFragment), 'expected selected option attribute');

  // The selected card should carry .selected. Personal-library-import has
  // seeded visual fragments, so the markup uses the .mc-option-card class.
  // A regex covering: class="mc-option-card selected" data-value="..."
  const re = new RegExp(
    'class="mc-option-card selected"[^>]*data-value="' +
      selectedValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '"',
  );
  assert.match(html, re, 'expected the chosen card to have class="mc-option-card selected"');
});

test('renderFeature escapes HTML in slug, name, and decision text', () => {
  const data = {
    status: {
      feature: '<script>alert(1)</script>',
      description: '"><img src=x onerror=alert(2)>',
    },
    decisions: {
      feature: 'xss-slug',
      phases: {
        ux: { status: 'not-started', decisions: [], pending: [] },
        ui: { status: 'not-started', decisions: [], pending: [] },
        architecture: { status: 'not-started', decisions: [], pending: [] },
      },
      deferred: [],
      updatedAt: '2026-05-26T10:00:00.000Z',
    },
    tabs: {
      ux: {
        key: 'ux',
        label: 'UX',
        status: 'not-started',
        statusLabel: 'Not started',
        decisions: [
          {
            id: 'evil-id',
            category: 'ux',
            question: '<img src=x onerror=alert(3)>',
            options: ['<svg/onload=alert(4)>'],
            selected: '<svg/onload=alert(4)>',
            decidedAt: '2026-05-26T10:00:00.000Z',
          },
        ],
        pending: ['<script>danger</script>'],
      },
      ui: {
        key: 'ui',
        label: 'UI',
        status: 'not-started',
        statusLabel: 'Not started',
        decisions: [],
        pending: [],
      },
      architecture: {
        key: 'architecture',
        label: 'Architecture',
        status: 'not-started',
        statusLabel: 'Not started',
        decisions: [],
        pending: [],
      },
    },
  };
  const html = renderFeature({ slug: 'xss-slug', data });

  assert.ok(
    !html.includes('<script>alert(1)</script>'),
    'raw script tag from feature name must not appear',
  );
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(
    !html.includes('<img src=x onerror=alert(3)>'),
    'raw img tag from question must not appear',
  );
  assert.ok(!html.includes('<svg/onload=alert(4)>'), 'raw svg tag must not appear');
  assert.ok(
    !html.includes('<script>danger</script>'),
    'raw script tag from pending must not appear',
  );
});

test('loadFeatureData attaches fragmentHtml when decision fragment file exists', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-v5-frag-'));
  try {
    const featureDir = path.join(tmp, 'control', 'v5', 'features', 'frag-feature');
    await fs.mkdir(featureDir, { recursive: true });
    const decisionsDir = path.join(featureDir, 'decisions');
    await fs.mkdir(decisionsDir, { recursive: true });

    await fs.writeFile(
      path.join(featureDir, 'status.json'),
      JSON.stringify({
        slug: 'frag-feature',
        feature: 'Fragment Feature',
        stage: 'in-progress',
      }),
      'utf8',
    );
    await fs.writeFile(
      path.join(featureDir, 'decisions.json'),
      JSON.stringify({
        feature: 'frag-feature',
        phases: {
          ux: {
            status: 'in-progress',
            decisions: [
              {
                id: 'with-fragment',
                category: 'ux',
                question: 'Which path?',
                options: ['A', 'B'],
                selected: 'A',
                decidedAt: '2026-05-26T10:00:00.000Z',
              },
              {
                id: 'no-fragment',
                category: 'ux',
                question: 'Other?',
                options: ['X', 'Y'],
                selected: 'X',
                decidedAt: '2026-05-26T10:00:00.000Z',
              },
            ],
            pending: [],
          },
          ui: { status: 'not-started', decisions: [], pending: [] },
          architecture: { status: 'not-started', decisions: [], pending: [] },
        },
        deferred: [],
        updatedAt: '2026-05-26T10:00:00.000Z',
      }),
      'utf8',
    );
    await fs.writeFile(
      path.join(decisionsDir, 'with-fragment.html'),
      '<div class="mc-options-grid" data-group="with-fragment" data-category="ux" data-question="Which path?"><div class="mc-option-card" data-value="A">A</div><div class="mc-option-card" data-value="B">B</div></div>',
      'utf8',
    );

    const data = await loadFeatureData({ slug: 'frag-feature', controlRoot: tmp });
    const decisions = data.tabs.ux.decisions;
    const withFrag = decisions.find((d) => d.id === 'with-fragment');
    const noFrag = decisions.find((d) => d.id === 'no-fragment');
    assert.ok(withFrag, 'with-fragment decision should be loaded');
    assert.ok(typeof withFrag.fragmentHtml === 'string');
    assert.match(withFrag.fragmentHtml, /mc-options-grid/);
    assert.equal(noFrag.fragmentHtml, null);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('renderFeature inlines fragment HTML when fragmentHtml is present and marks selected', () => {
  const data = {
    status: { slug: 'inline', feature: 'Inline' },
    decisions: {
      feature: 'inline',
      phases: {
        ux: {
          status: 'in-progress',
          decisions: [
            {
              id: 'd1',
              category: 'ux',
              question: 'Q1',
              options: ['A', 'B'],
              selected: 'B',
              fragmentHtml:
                '<div class="mc-options-grid" data-group="d1" data-category="ux" data-question="Q1">\n' +
                '  <div class="mc-option-card selected" data-value="A" aria-checked="true">A</div>\n' +
                '  <div class="mc-option-card" data-value="B" aria-checked="false">B</div>\n' +
                '</div>',
            },
          ],
          pending: [],
        },
        ui: { status: 'not-started', decisions: [], pending: [] },
        architecture: { status: 'not-started', decisions: [], pending: [] },
      },
      deferred: [],
      updatedAt: '2026-05-26T10:00:00.000Z',
    },
    tabs: {
      ux: {
        key: 'ux',
        label: 'UX',
        status: 'in-progress',
        statusLabel: 'In progress',
        decisions: [
          {
            id: 'd1',
            category: 'ux',
            question: 'Q1',
            options: ['A', 'B'],
            selected: 'B',
            fragmentHtml:
              '<div class="mc-options-grid" data-group="d1" data-category="ux" data-question="Q1">\n' +
              '  <div class="mc-option-card selected" data-value="A" aria-checked="true">A</div>\n' +
              '  <div class="mc-option-card" data-value="B" aria-checked="false">B</div>\n' +
              '</div>',
          },
        ],
        pending: [],
      },
      ui: {
        key: 'ui',
        label: 'UI',
        status: 'not-started',
        statusLabel: 'Not started',
        decisions: [],
        pending: [],
      },
      architecture: {
        key: 'architecture',
        label: 'Architecture',
        status: 'not-started',
        statusLabel: 'Not started',
        decisions: [],
        pending: [],
      },
    },
  };
  const html = renderFeature({ slug: 'inline', data });
  // Fragment class survives inlining.
  assert.ok(html.includes('class="mc-options-grid"'));
  assert.ok(html.includes('data-group="d1"'));
  // .selected was on A in the fragment; renderer must move it to B (the
  // server-side selection wins).
  assert.match(
    html,
    /<div class="mc-option-card selected"[^>]*data-value="B"/,
    'expected B card to be marked selected',
  );
  // A card must no longer have the selected class.
  assert.ok(
    !/data-value="A"[^>]*class="mc-option-card selected"/.test(html),
  );
  assert.ok(
    !/class="mc-option-card selected"[^>]*data-value="A"/.test(html),
  );
  // aria-checked must be flipped.
  assert.match(html, /aria-checked="true"[^>]*data-value="B"|data-value="B"[^>]*aria-checked="true"/);
});

test('renderFeature falls back to text-only card when fragmentHtml is absent', () => {
  const data = {
    status: { slug: 'plain', feature: 'Plain' },
    decisions: {
      feature: 'plain',
      phases: {
        ux: {
          status: 'in-progress',
          decisions: [
            {
              id: 'plain-d',
              category: 'ux',
              question: 'Q?',
              options: ['Opt1'],
              selected: 'Opt1',
              // fragmentHtml deliberately absent
            },
          ],
          pending: [],
        },
        ui: { status: 'not-started', decisions: [], pending: [] },
        architecture: { status: 'not-started', decisions: [], pending: [] },
      },
      deferred: [],
      updatedAt: '2026-05-26T10:00:00.000Z',
    },
    tabs: {
      ux: {
        key: 'ux',
        label: 'UX',
        status: 'in-progress',
        statusLabel: 'In progress',
        decisions: [
          {
            id: 'plain-d',
            category: 'ux',
            question: 'Q?',
            options: ['Opt1'],
            selected: 'Opt1',
          },
        ],
        pending: [],
      },
      ui: {
        key: 'ui',
        label: 'UI',
        status: 'not-started',
        statusLabel: 'Not started',
        decisions: [],
        pending: [],
      },
      architecture: {
        key: 'architecture',
        label: 'Architecture',
        status: 'not-started',
        statusLabel: 'Not started',
        decisions: [],
        pending: [],
      },
    },
  };
  const html = renderFeature({ slug: 'plain', data });
  // Falls back to the legacy text-card markup.
  assert.match(html, /class="options-grid"[^>]*data-group="plain-d"/);
  assert.match(
    html,
    /class="option-card selected"[^>]*data-value="Opt1"/,
  );
});

test('renderFeature contains top-level nav with Decisions and Documentation tabs', async () => {
  const data = await loadFeatureData({
    slug: 'personal-library-import',
    controlRoot: SAMPLE_V5,
  });
  const html = renderFeature({ slug: 'personal-library-import', data });

  // Top-tabs nav present.
  assert.ok(/<nav class="top-tabs"/.test(html), 'expected <nav class="top-tabs">');
  // Both top-tabs present.
  assert.ok(/data-top-tab="decisions"/.test(html), 'expected decisions top-tab');
  assert.ok(/data-top-tab="documentation"/.test(html), 'expected documentation top-tab');
  // Labels.
  assert.ok(/>Decisions</.test(html), 'expected Decisions label');
  assert.ok(/>Documentation</.test(html), 'expected Documentation label');
});

test('renderFeature default top-tab state: Decisions visible, Documentation not', async () => {
  const data = await loadFeatureData({
    slug: 'personal-library-import',
    controlRoot: SAMPLE_V5,
  });
  const html = renderFeature({ slug: 'personal-library-import', data });

  // Decisions top-section is .visible by default.
  assert.ok(
    /<section class="top-section visible" data-top-tab="decisions"/.test(html),
    'expected decisions top-section to be visible by default',
  );
  // Documentation top-section exists but is not visible.
  assert.ok(
    /<section class="top-section" data-top-tab="documentation"/.test(html),
    'expected documentation top-section to be hidden by default',
  );
  // The Decisions top-tab carries .active.
  assert.ok(
    /class="top-tab active"[^>]*data-top-tab="decisions"/.test(html),
    'expected Decisions top-tab to be .active on first paint',
  );
});

test('renderFeature Documentation section contains all six sub-tabs', async () => {
  const data = await loadFeatureData({
    slug: 'personal-library-import',
    controlRoot: SAMPLE_V5,
  });
  const html = renderFeature({ slug: 'personal-library-import', data });

  // Extract the documentation top-section so we don't accidentally match
  // sub-tabs from the decisions side.
  const docMatch = html.match(
    /<section class="top-section[^"]*" data-top-tab="documentation"[\s\S]*?<\/section>/,
  );
  assert.ok(docMatch, 'expected documentation top-section to be present');
  const docHtml = docMatch[0];

  for (const key of ['doc-spec', 'doc-tasks', 'doc-phases', 'doc-journal', 'doc-explore', 'doc-wireframes']) {
    assert.ok(
      docHtml.includes(`data-tab="${key}"`),
      `expected documentation sub-tab data-tab="${key}"`,
    );
  }
  for (const label of ['Spec', 'Tasks', 'Phases', 'Journal', 'Explore', 'Wireframes']) {
    assert.ok(docHtml.includes(label), `expected sub-tab label ${label}`);
  }
});

test('renderFeature Documentation defaults to Spec sub-tab visible', async () => {
  const data = await loadFeatureData({
    slug: 'personal-library-import',
    controlRoot: SAMPLE_V5,
  });
  const html = renderFeature({ slug: 'personal-library-import', data });
  const docMatch = html.match(
    /<section class="top-section[^"]*" data-top-tab="documentation"[\s\S]*?<\/section>/,
  );
  assert.ok(docMatch);
  const docHtml = docMatch[0];

  // Spec sub-tab is .active.
  assert.ok(
    /class="tab active"[^>]*data-tab="doc-spec"/.test(docHtml),
    'expected doc-spec sub-tab to be .active',
  );
  // Spec section is .visible.
  assert.ok(
    /<div class="section visible" data-tab-section="doc-spec"/.test(docHtml),
    'expected doc-spec section to be .visible by default',
  );
  // Other doc sections are not .visible.
  for (const key of ['doc-tasks', 'doc-phases', 'doc-journal', 'doc-explore', 'doc-wireframes']) {
    assert.ok(
      new RegExp(`<div class="section" data-tab-section="${key}"`).test(docHtml),
      `expected ${key} section to be hidden (no .visible) by default`,
    );
  }
});

test('renderFeature handles tabs with no decisions (empty state)', () => {
  const data = {
    status: { slug: 'blank', feature: 'Blank' },
    decisions: {
      feature: 'blank',
      phases: {
        ux: { status: 'not-started', decisions: [], pending: [] },
        ui: { status: 'not-started', decisions: [], pending: [] },
        architecture: { status: 'not-started', decisions: [], pending: [] },
      },
      deferred: [],
      updatedAt: '2026-05-26T10:00:00.000Z',
    },
    tabs: {
      ux: {
        key: 'ux',
        label: 'UX',
        status: 'not-started',
        statusLabel: 'Not started',
        decisions: [],
        pending: [],
      },
      ui: {
        key: 'ui',
        label: 'UI',
        status: 'not-started',
        statusLabel: 'Not started',
        decisions: [],
        pending: [],
      },
      architecture: {
        key: 'architecture',
        label: 'Architecture',
        status: 'not-started',
        statusLabel: 'Not started',
        decisions: [],
        pending: [],
      },
    },
  };
  const html = renderFeature({ slug: 'blank', data });
  assert.ok(html.includes('No UX decisions yet'));
  assert.ok(html.includes('No UI decisions yet'));
  assert.ok(html.includes('No Architecture decisions yet'));
});

test('renderFeature links to feature.css, feature-client.js, and shared diagram scripts', async () => {
  const data = await loadFeatureData({
    slug: 'personal-library-import',
    controlRoot: SAMPLE_V5,
  });
  const html = renderFeature({ slug: 'personal-library-import', data });
  assert.ok(html.includes('/feature.css'), 'expected /feature.css link');
  assert.ok(html.includes('/feature-client.js'), 'expected /feature-client.js script');
  assert.ok(html.includes('/diagrams/_shared/diagram.css'), 'expected diagram.css link');
  assert.ok(html.includes('/diagrams/_shared/diagram-select.js'));
  assert.ok(html.includes('/diagrams/_shared/decisions-client.js'));
});

test('renderFeature embeds preloaded decisions as JSON for client merge', async () => {
  const data = await loadFeatureData({
    slug: 'personal-library-import',
    controlRoot: SAMPLE_V5,
  });
  const html = renderFeature({ slug: 'personal-library-import', data });
  assert.ok(html.includes('id="mc-feature-state"'));
  // The slug should be embedded in the state blob.
  assert.ok(html.includes('"slug":"personal-library-import"'));
});

// ---------------------------------------------------------------------------
// Server integration
// ---------------------------------------------------------------------------

test('GET /feature/personal-library-import returns the rendered feature page', async () => {
  const handle = await startServer({ controlRoot: SAMPLE_V5, port: 0 });
  try {
    const res = await fetch(`${handle.url}/feature/personal-library-import`);
    assert.equal(res.status, 200);
    const ct = res.headers.get('content-type') || '';
    assert.ok(ct.includes('text/html'));
    const html = await res.text();
    assert.ok(html.includes('Personal Library Import'));
    assert.ok(html.includes('Save All Decisions'));
    assert.ok(html.includes('data-tab="ux"'));
    assert.ok(html.includes('data-tab="ui"'));
    assert.ok(html.includes('data-tab="architecture"'));
  } finally {
    await handle.close();
  }
});

test('GET /feature/missing-slug returns 404 JSON', async () => {
  const handle = await startServer({ controlRoot: SAMPLE_V5, port: 0 });
  try {
    const res = await fetch(`${handle.url}/feature/does-not-exist-feature`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.ok(body.error);
  } finally {
    await handle.close();
  }
});

test('GET /feature.css returns CSS with text/css content type', async () => {
  const handle = await startServer({ controlRoot: SAMPLE_V5, port: 0 });
  try {
    const res = await fetch(`${handle.url}/feature.css`);
    assert.equal(res.status, 200);
    const ct = res.headers.get('content-type') || '';
    assert.ok(ct.includes('text/css'), `expected text/css, got: ${ct}`);
    const body = await res.text();
    assert.ok(body.includes('.option-card') || body.includes('option-card'));
  } finally {
    await handle.close();
  }
});

test('GET /feature-client.js returns JS with javascript content type', async () => {
  const handle = await startServer({ controlRoot: SAMPLE_V5, port: 0 });
  try {
    const res = await fetch(`${handle.url}/feature-client.js`);
    assert.equal(res.status, 200);
    const ct = res.headers.get('content-type') || '';
    assert.ok(ct.includes('javascript'), `expected javascript, got: ${ct}`);
    const body = await res.text();
    assert.ok(body.length > 50, 'expected non-trivial JS body');
  } finally {
    await handle.close();
  }
});

test('POST /api/v5/decisions/:slug round-trips: save then GET feature page reflects it', async () => {
  // Use a temp control root so we don't mutate the sample-project fixture.
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-v5-feat-server-'));
  try {
    const featureDir = path.join(tmp, 'control', 'v5', 'features', 'rt-feature');
    await fs.mkdir(featureDir, { recursive: true });
    await fs.writeFile(
      path.join(featureDir, 'status.json'),
      JSON.stringify({
        slug: 'rt-feature',
        feature: 'Roundtrip Feature',
        stage: 'in-progress',
        description: 'Roundtrip test fixture',
        lastUpdatedAt: '2026-05-26T10:00:00.000Z',
      }),
      'utf8',
    );

    const handle = await startServer({ controlRoot: tmp, port: 0 });
    try {
      // 1) Save a decision under architecture.
      const payload = {
        feature: 'rt-feature',
        phases: {
          ux: { status: 'not-started', decisions: [], pending: [] },
          ui: { status: 'not-started', decisions: [], pending: [] },
          architecture: {
            status: 'in-progress',
            decisions: [
              {
                id: 'arch-transport',
                category: 'engineering',
                question: 'What transport?',
                options: ['WebSocket', 'SSE', 'WebRTC'],
                selected: 'WebSocket',
                decidedAt: '2026-05-26T10:30:00.000Z',
              },
            ],
            pending: [],
          },
        },
        deferred: [],
        updatedAt: '2026-05-26T10:30:00.000Z',
      };
      const postRes = await fetch(`${handle.url}/api/v5/decisions/rt-feature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      assert.equal(postRes.status, 200);

      // 2) GET the feature page; selected option should be marked.
      const pageRes = await fetch(`${handle.url}/feature/rt-feature`);
      assert.equal(pageRes.status, 200);
      const html = await pageRes.text();
      assert.ok(html.includes('Roundtrip Feature'));
      assert.ok(html.includes('data-group="arch-transport"'));
      assert.ok(
        /class="option-card selected"[^>]*data-value="WebSocket"/.test(html),
        'expected WebSocket card to be marked selected after save',
      );
    } finally {
      await handle.close();
    }
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
