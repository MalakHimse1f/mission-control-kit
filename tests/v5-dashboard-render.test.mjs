/**
 * Tests for v5 dashboard rendering:
 *   - lib/v5/dashboard-data.mjs            (loadDashboardData)
 *   - control/scripts/v5/render-dashboard.mjs (renderDashboard)
 *
 * Plus a small smoke test that the Task-3 dashboard server now serves the
 * real dashboard HTML (containing the section labels) at GET /.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { loadDashboardData } from '../lib/v5/dashboard-data.mjs';
import { renderDashboard } from '../control/scripts/v5/render-dashboard.mjs';
import { startServer } from '../control/scripts/v5/dashboard-server.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const SAMPLE_V5 = path.join(REPO_ROOT, 'sample-project', 'control', 'v5');

// ---------------------------------------------------------------------------
// loadDashboardData
// ---------------------------------------------------------------------------

test('loadDashboardData buckets sample-project features correctly', async () => {
  const data = await loadDashboardData({ controlRoot: SAMPLE_V5 });

  // liveAgents: in-progress
  assert.equal(data.liveAgents.length, 1);
  assert.equal(data.liveAgents[0].slug, 'progress-tracker');
  assert.equal(data.liveAgents[0].stage, 'in-progress');

  // upNext: first ready
  assert.ok(data.upNext, 'expected upNext to be present');
  assert.equal(data.upNext.slug, 'backlog-prioritization');
  assert.equal(data.upNext.stage, 'ready');

  // allItems: 4 items
  assert.equal(data.allItems.length, 4);
  const slugs = data.allItems.map((f) => f.slug).sort();
  assert.deepEqual(slugs, [
    'backlog-prioritization',
    'cross-media-search',
    'personal-library-import',
    'progress-tracker',
  ]);

  // filterCounts add up
  const counts = data.filterCounts;
  assert.equal(counts.needsInput, 1);
  assert.equal(counts.ready, 1);
  assert.equal(counts.inProgress, 1);
  assert.equal(counts.complete, 1);
  const total = counts.needsInput + counts.ready + counts.inProgress + counts.complete;
  assert.equal(total, data.allItems.length);
});

test('loadDashboardData handles missing features directory gracefully', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-v5-dash-data-'));
  try {
    const data = await loadDashboardData({ controlRoot: tmp });
    assert.deepEqual(data.liveAgents, []);
    assert.equal(data.upNext, null);
    assert.deepEqual(data.allItems, []);
    assert.deepEqual(data.filterCounts, {
      needsInput: 0,
      ready: 0,
      inProgress: 0,
      complete: 0,
    });
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('loadDashboardData reads status.stage (not pipelineStage)', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-v5-stage-'));
  try {
    const featureDir = path.join(tmp, 'features', 'alpha');
    await fs.mkdir(featureDir, { recursive: true });
    await fs.writeFile(
      path.join(featureDir, 'status.json'),
      JSON.stringify({
        slug: 'alpha',
        stage: 'in-progress',
        // pipelineStage intentionally absent
        lastUpdatedAt: '2026-05-26T10:00:00.000Z',
      }),
      'utf8',
    );
    const data = await loadDashboardData({ controlRoot: tmp });
    assert.equal(data.liveAgents.length, 1);
    assert.equal(data.liveAgents[0].stage, 'in-progress');
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('loadDashboardData picks first ready feature for upNext when several are ready', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-v5-upnext-'));
  try {
    for (const slug of ['zeta', 'alpha', 'beta']) {
      const dir = path.join(tmp, 'features', slug);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        path.join(dir, 'status.json'),
        JSON.stringify({
          slug,
          stage: 'ready',
          lastUpdatedAt: '2026-05-26T10:00:00.000Z',
        }),
        'utf8',
      );
    }
    const data = await loadDashboardData({ controlRoot: tmp });
    // Sorted alphabetically -> alpha is first
    assert.ok(data.upNext);
    assert.equal(data.upNext.slug, 'alpha');
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// renderDashboard
// ---------------------------------------------------------------------------

test('renderDashboard returns full HTML with all three section labels', async () => {
  const data = await loadDashboardData({ controlRoot: SAMPLE_V5 });
  const html = renderDashboard(data);

  assert.ok(html.startsWith('<!doctype html') || html.startsWith('<!DOCTYPE html'));
  assert.ok(html.includes('Live Agents'), 'expected "Live Agents" section label');
  assert.ok(html.includes('Up Next'), 'expected "Up Next" section label');
  assert.ok(html.includes('All Items'), 'expected "All Items" section label');
});

test('renderDashboard contains each filter pill name and count', async () => {
  const data = await loadDashboardData({ controlRoot: SAMPLE_V5 });
  const html = renderDashboard(data);

  assert.ok(html.includes('Needs Your Input'), 'expected "Needs Your Input" pill');
  assert.ok(html.includes('Ready'), 'expected "Ready" pill');
  assert.ok(html.includes('In Progress'), 'expected "In Progress" pill');
  assert.ok(html.includes('Complete'), 'expected "Complete" pill');

  // Counts should reflect filterCounts
  assert.ok(html.includes(`(${data.filterCounts.needsInput})`));
  assert.ok(html.includes(`(${data.filterCounts.ready})`));
  assert.ok(html.includes(`(${data.filterCounts.inProgress})`));
  assert.ok(html.includes(`(${data.filterCounts.complete})`));
});

test('renderDashboard item rows link to /feature/:slug', async () => {
  const data = await loadDashboardData({ controlRoot: SAMPLE_V5 });
  const html = renderDashboard(data);

  for (const item of data.allItems) {
    assert.ok(
      html.includes(`/feature/${item.slug}`),
      `expected link to /feature/${item.slug}`,
    );
  }
});

test('renderDashboard links to /dashboard.css and /dashboard-client.js', async () => {
  const data = await loadDashboardData({ controlRoot: SAMPLE_V5 });
  const html = renderDashboard(data);
  assert.ok(html.includes('/dashboard.css'), 'expected /dashboard.css link');
  assert.ok(html.includes('/dashboard-client.js'), 'expected /dashboard-client.js script');
});

test('renderDashboard handles empty data (no live agents, no up next, no items)', () => {
  const empty = {
    liveAgents: [],
    upNext: null,
    allItems: [],
    filterCounts: { needsInput: 0, ready: 0, inProgress: 0, complete: 0 },
  };
  const html = renderDashboard(empty);
  assert.ok(html.length > 200, 'expected non-trivial HTML');
  assert.ok(
    html.includes('No agents currently working'),
    'expected empty-state copy for live agents',
  );
  assert.ok(html.includes('Queue is clear'), 'expected empty-state copy for up next');
});

test('renderDashboard escapes HTML in slugs and stages', () => {
  const data = {
    liveAgents: [
      {
        slug: '<script>alert(1)</script>',
        stage: 'in-progress',
        currentPhase: 'build',
        lastUpdatedAt: '2026-05-26T10:00:00.000Z',
      },
    ],
    upNext: null,
    allItems: [
      {
        slug: '<script>alert(1)</script>',
        stage: 'in-progress',
        currentPhase: 'build',
        lastUpdatedAt: '2026-05-26T10:00:00.000Z',
      },
    ],
    filterCounts: { needsInput: 0, ready: 0, inProgress: 1, complete: 0 },
  };
  const html = renderDashboard(data);
  assert.ok(!html.includes('<script>alert(1)</script>'), 'raw script tag should not appear');
  assert.ok(html.includes('&lt;script&gt;'), 'expected escaped angle brackets');
});

// ---------------------------------------------------------------------------
// Server integration
// ---------------------------------------------------------------------------

test('GET / on dashboard server returns rendered dashboard with three sections', async () => {
  const handle = await startServer({ controlRoot: SAMPLE_V5, port: 0 });
  try {
    const res = await fetch(`${handle.url}/`);
    assert.equal(res.status, 200);
    const ct = res.headers.get('content-type') || '';
    assert.ok(ct.includes('text/html'));
    const html = await res.text();
    assert.ok(html.includes('Live Agents'));
    assert.ok(html.includes('Up Next'));
    assert.ok(html.includes('All Items'));
    assert.ok(html.includes('Needs Your Input'));
  } finally {
    await handle.close();
  }
});

test('GET /dashboard.css returns CSS with text/css content type', async () => {
  const handle = await startServer({ controlRoot: SAMPLE_V5, port: 0 });
  try {
    const res = await fetch(`${handle.url}/dashboard.css`);
    assert.equal(res.status, 200);
    const ct = res.headers.get('content-type') || '';
    assert.ok(ct.includes('text/css'), `expected text/css, got: ${ct}`);
    const body = await res.text();
    assert.ok(body.includes('.filter-pill') || body.includes('filter-pill'));
  } finally {
    await handle.close();
  }
});

test('GET /dashboard-client.js returns JS with javascript content type', async () => {
  const handle = await startServer({ controlRoot: SAMPLE_V5, port: 0 });
  try {
    const res = await fetch(`${handle.url}/dashboard-client.js`);
    assert.equal(res.status, 200);
    const ct = res.headers.get('content-type') || '';
    assert.ok(ct.includes('javascript'), `expected javascript, got: ${ct}`);
    const body = await res.text();
    assert.ok(body.length > 50, 'expected non-trivial JS body');
  } finally {
    await handle.close();
  }
});
