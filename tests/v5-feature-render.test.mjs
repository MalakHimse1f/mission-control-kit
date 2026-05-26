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
const SAMPLE_V5 = path.join(REPO_ROOT, 'sample-project', 'control', 'v5');

// ---------------------------------------------------------------------------
// loadFeatureData
// ---------------------------------------------------------------------------

test('loadFeatureData returns the expected shape for team-collab', async () => {
  const data = await loadFeatureData({
    slug: 'team-collab',
    controlRoot: SAMPLE_V5,
  });
  assert.equal(data.slug, 'team-collab');
  assert.equal(data.status.feature, 'Team Collaboration');
  assert.ok(data.decisions);
  assert.equal(data.decisions.feature, 'team-collab');

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
  assert.deepEqual(data.tabs.architecture.pending, ['arch-sync-algorithm']);
});

test('loadFeatureData throws ENOFEATURE for a missing slug', async () => {
  await assert.rejects(
    () => loadFeatureData({ slug: 'does-not-exist', controlRoot: SAMPLE_V5 }),
    (err) => err && err.code === 'ENOFEATURE',
  );
});

test('loadFeatureData throws on missing slug or controlRoot', async () => {
  await assert.rejects(() => loadFeatureData({ controlRoot: SAMPLE_V5 }), /slug/);
  await assert.rejects(() => loadFeatureData({ slug: 'team-collab' }), /controlRoot/);
});

test('loadFeatureData synthesizes defaults when status.json is missing', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-v5-feature-'));
  try {
    const featureDir = path.join(tmp, 'features', 'minimal');
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
    slug: 'team-collab',
    controlRoot: SAMPLE_V5,
  });
  const html = renderFeature({ slug: 'team-collab', data });

  assert.ok(
    html.startsWith('<!doctype html') || html.startsWith('<!DOCTYPE html'),
  );

  // Breadcrumb back to dashboard.
  assert.ok(html.includes('href="/"'), 'expected breadcrumb back-link to /');
  assert.ok(html.includes('Team Collaboration'), 'expected feature name in breadcrumb/header');

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
    slug: 'team-collab',
    controlRoot: SAMPLE_V5,
  });
  const html = renderFeature({ slug: 'team-collab', data });

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
    slug: 'team-collab',
    controlRoot: SAMPLE_V5,
  });
  const html = renderFeature({ slug: 'team-collab', data });

  // The architecture decision picked "WebSocket with custom protocol".
  const arch = data.tabs.architecture.decisions[0];
  const selectedValue = arch.selected;
  const selectedFragment = `data-value="${selectedValue}"`;
  assert.ok(html.includes(selectedFragment), 'expected selected option attribute');

  // The selected card should carry .selected. We check that the class
  // marker appears in the HTML next to the picked value (within the card).
  // A regex covering: class="option-card selected" data-value="..."
  // OR: class="option-card selected" ... data-value="..."
  const re = new RegExp(
    'class="option-card selected"[^>]*data-value="' +
      selectedValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '"',
  );
  assert.match(html, re, 'expected the chosen card to have class="option-card selected"');
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
    slug: 'team-collab',
    controlRoot: SAMPLE_V5,
  });
  const html = renderFeature({ slug: 'team-collab', data });
  assert.ok(html.includes('/feature.css'), 'expected /feature.css link');
  assert.ok(html.includes('/feature-client.js'), 'expected /feature-client.js script');
  assert.ok(html.includes('/diagrams/_shared/diagram-select.js'));
  assert.ok(html.includes('/diagrams/_shared/decisions-client.js'));
});

test('renderFeature embeds preloaded decisions as JSON for client merge', async () => {
  const data = await loadFeatureData({
    slug: 'team-collab',
    controlRoot: SAMPLE_V5,
  });
  const html = renderFeature({ slug: 'team-collab', data });
  assert.ok(html.includes('id="mc-feature-state"'));
  // The slug should be embedded in the state blob.
  assert.ok(html.includes('"slug":"team-collab"'));
});

// ---------------------------------------------------------------------------
// Server integration
// ---------------------------------------------------------------------------

test('GET /feature/team-collab returns the rendered feature page', async () => {
  const handle = await startServer({ controlRoot: SAMPLE_V5, port: 0 });
  try {
    const res = await fetch(`${handle.url}/feature/team-collab`);
    assert.equal(res.status, 200);
    const ct = res.headers.get('content-type') || '';
    assert.ok(ct.includes('text/html'));
    const html = await res.text();
    assert.ok(html.includes('Team Collaboration'));
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
    const featureDir = path.join(tmp, 'features', 'rt-feature');
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
