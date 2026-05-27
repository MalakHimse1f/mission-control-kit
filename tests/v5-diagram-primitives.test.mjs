/**
 * Tests for the v5.1 atom + preset library at `lib/v5/diagram-primitives.mjs`.
 *
 * Coverage is structural — we assert the rendered fragments carry the right
 * classes, frame kinds, node kinds, edge kinds, and that ordering is
 * deterministic given the spec. Pixel-level rendering is not in scope; the
 * dashboard renders the same HTML.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFlowDiagram,
  buildScreenMockup,
  buildArchDiagram,
  buildArchNode,
  buildArchEdge,
  buildBodyElement,
  renderDiagramSpec,
  renderPreset,
  listPresets,
  PRESETS,
} from '../lib/v5/diagram-primitives.mjs';

// ---------------------------------------------------------------------------
// UX flow
// ---------------------------------------------------------------------------

test('buildFlowDiagram emits one .mc-flow-step per spec.step', () => {
  const html = buildFlowDiagram({
    steps: [
      { label: 'Open', kind: 'start' },
      { label: 'Choose', kind: 'decision' },
      { label: 'Done', kind: 'end' },
    ],
  });
  assert.match(html, /mc-flow-timeline/);
  assert.equal((html.match(/mc-flow-step/g) || []).length, 3);
  assert.match(html, /mc-flow-step start/);
  assert.match(html, /mc-flow-step decision/);
  assert.match(html, /mc-flow-step end/);
  assert.match(html, />Open</);
  assert.match(html, />Choose</);
  assert.match(html, />Done</);
});

test('buildFlowDiagram surfaces swimlane data attribute', () => {
  const html = buildFlowDiagram({ steps: [{ label: 'a' }], swimlane: 'user' });
  assert.match(html, /data-swimlane="user"/);
  const sys = buildFlowDiagram({ steps: [{ label: 'a' }], swimlane: 'system' });
  assert.match(sys, /data-swimlane="system"/);
});

test('buildFlowDiagram escapes labels', () => {
  const html = buildFlowDiagram({ steps: [{ label: '<script>x</script>' }] });
  assert.ok(!html.includes('<script>'), 'must escape script tags in labels');
  assert.match(html, /&lt;script&gt;/);
});

test('buildFlowDiagram defaults missing step kind to "step"', () => {
  const html = buildFlowDiagram({ steps: [{ label: 'plain' }] });
  assert.match(html, /mc-flow-step step/);
});

// ---------------------------------------------------------------------------
// UI screen mockup
// ---------------------------------------------------------------------------

test('buildScreenMockup renders the requested frame kind', () => {
  for (const frame of ['phone', 'desktop', 'modal', 'card']) {
    const html = buildScreenMockup({ frame, body: [] });
    assert.match(html, new RegExp(`mc-screen ${frame}`), `frame=${frame}`);
  }
});

test('buildScreenMockup ignores unknown frame kinds and defaults to phone', () => {
  const html = buildScreenMockup({ frame: 'hologram', body: [] });
  assert.match(html, /mc-screen phone/);
});

test('buildScreenMockup wires header back/title/actions', () => {
  const html = buildScreenMockup({
    frame: 'phone',
    header: { title: 'Library', back: true, actions: ['search', 'settings'] },
    body: [],
  });
  assert.match(html, /mc-screen-back/);
  assert.match(html, /mc-screen-title">Library</);
  assert.match(html, /mc-screen-actions/);
  // Two icons rendered
  assert.equal((html.match(/mc-icon/g) || []).length, 2);
});

test('buildBodyElement dispatches by kind for every known atom', () => {
  const kinds = ['list', 'grid', 'form', 'hero', 'text', 'buttons', 'empty'];
  for (const kind of kinds) {
    const html = buildBodyElement({ kind, items: [], fields: [], lines: 1 });
    assert.ok(html.length > 0, `${kind} should render to non-empty HTML`);
  }
});

test('buildBodyElement returns empty string for unknown kinds (no crash)', () => {
  assert.equal(buildBodyElement({ kind: 'spaceship' }), '');
  assert.equal(buildBodyElement(null), '');
});

test('list, grid, form bodies emit one DOM child per item', () => {
  const list = buildBodyElement({
    kind: 'list',
    items: [{ title: 'a' }, { title: 'b' }, { title: 'c' }],
  });
  assert.equal((list.match(/mc-list-item/g) || []).length, 3);
  const grid = buildBodyElement({
    kind: 'grid',
    cols: 2,
    items: [{ label: 'a' }, { label: 'b' }, { label: 'c' }, { label: 'd' }],
  });
  assert.match(grid, /data-cols="2"/);
  assert.equal((grid.match(/mc-grid-item/g) || []).length, 4);
  const form = buildBodyElement({
    kind: 'form',
    fields: [{ kind: 'text', label: 't' }, { kind: 'toggle', label: 'g' }],
  });
  assert.equal((form.match(/mc-form-field/g) || []).length, 2);
  assert.match(form, /data-kind="toggle"/);
});

test('tab-bar footer renders one .mc-tab per item with first tab active', () => {
  const html = buildScreenMockup({
    frame: 'phone',
    body: [],
    footer: { kind: 'tab-bar', items: ['Home', 'Library', 'Me'] },
  });
  assert.equal((html.match(/mc-tab\b/g) || []).length, 3);
  assert.match(html, /mc-tab active">Home</);
});

// ---------------------------------------------------------------------------
// Architecture
// ---------------------------------------------------------------------------

test('buildArchNode tags rendered class with the node kind', () => {
  for (const kind of ['client', 'service', 'db', 'queue', 'cache', 'edge', 'worker', 'external', 'actor', 'function']) {
    const html = buildArchNode({ id: 'x', kind, label: kind });
    assert.match(html, new RegExp(`mc-arch-node ${kind}`));
  }
});

test('buildArchNode falls back to service for unknown kinds', () => {
  const html = buildArchNode({ id: 'x', kind: 'spaceship', label: 'ship' });
  assert.match(html, /mc-arch-node service/);
});

test('buildArchEdge tags rendered class with the edge kind', () => {
  for (const kind of ['sync', 'async', 'data', 'dep']) {
    const html = buildArchEdge({ kind });
    assert.match(html, new RegExp(`mc-arch-edge ${kind}`));
  }
});

test('buildArchDiagram orders nodes by edge topology (sources first)', () => {
  const html = buildArchDiagram({
    nodes: [
      { id: 'db', kind: 'db', label: 'DB' },
      { id: 'client', kind: 'client', label: 'Client' },
      { id: 'api', kind: 'service', label: 'API' },
    ],
    edges: [
      { from: 'client', to: 'api', kind: 'sync' },
      { from: 'api', to: 'db', kind: 'data' },
    ],
  });
  // Client must appear before API which must appear before DB.
  const clientIdx = html.indexOf('Client');
  const apiIdx = html.indexOf('API');
  const dbIdx = html.indexOf('DB');
  assert.ok(clientIdx >= 0 && apiIdx > clientIdx, 'client before api');
  assert.ok(apiIdx > 0 && dbIdx > apiIdx, 'api before db');
});

test('buildArchDiagram includes one edge between each adjacent pair', () => {
  const html = buildArchDiagram({
    nodes: [
      { id: 'a', kind: 'client', label: 'A' },
      { id: 'b', kind: 'service', label: 'B' },
      { id: 'c', kind: 'db', label: 'C' },
    ],
    edges: [
      { from: 'a', to: 'b', kind: 'sync' },
      { from: 'b', to: 'c', kind: 'data' },
    ],
  });
  // 3 nodes => 2 edges between them.
  assert.equal((html.match(/mc-arch-edge/g) || []).length, 2);
});

test('buildArchDiagram tolerates disconnected nodes', () => {
  const html = buildArchDiagram({
    nodes: [
      { id: 'a', kind: 'client', label: 'A' },
      { id: 'b', kind: 'db', label: 'B' },
    ],
    edges: [], // no edges
  });
  // Two nodes, one default edge between them.
  assert.equal((html.match(/mc-arch-node/g) || []).length, 2);
  assert.equal((html.match(/mc-arch-edge/g) || []).length, 1);
});

// ---------------------------------------------------------------------------
// Top-level dispatcher
// ---------------------------------------------------------------------------

test('renderDiagramSpec dispatches by category', () => {
  assert.match(renderDiagramSpec('ux', { steps: [{ label: 'a' }] }), /mc-flow-timeline/);
  assert.match(renderDiagramSpec('ui', { frame: 'phone', body: [] }), /mc-screen phone/);
  assert.match(
    renderDiagramSpec('engineering', { nodes: [{ id: 'a', kind: 'db', label: 'A' }], edges: [] }),
    /mc-arch-node db/,
  );
  assert.match(
    renderDiagramSpec('architecture', { nodes: [{ id: 'a', kind: 'db', label: 'A' }], edges: [] }),
    /mc-arch-node db/,
  );
  assert.equal(renderDiagramSpec('cooking', { recipe: 'pasta' }), null);
  assert.equal(renderDiagramSpec('ux', null), null);
});

// ---------------------------------------------------------------------------
// Preset library
// ---------------------------------------------------------------------------

test('every UX preset renders a flow timeline with at least 3 steps', () => {
  for (const name of listPresets('ux')) {
    const html = renderPreset('ux', name);
    assert.ok(html, `preset ${name} should render`);
    assert.match(html, /mc-flow-timeline/, `${name} should be a flow`);
    const stepCount = (html.match(/mc-flow-step/g) || []).length;
    assert.ok(stepCount >= 3, `${name} should have >= 3 steps, got ${stepCount}`);
  }
});

test('every UI preset renders a screen mockup with a frame kind', () => {
  for (const name of listPresets('ui')) {
    const html = renderPreset('ui', name);
    assert.ok(html, `preset ${name} should render`);
    assert.match(html, /mc-screen (phone|desktop|modal|card)/, `${name} frame`);
  }
});

test('every architecture preset renders >= 2 nodes connected by edges', () => {
  for (const name of listPresets('engineering')) {
    const html = renderPreset('engineering', name);
    assert.ok(html, `preset ${name} should render`);
    const nodeCount = (html.match(/mc-arch-node/g) || []).length;
    const edgeCount = (html.match(/mc-arch-edge/g) || []).length;
    assert.ok(nodeCount >= 2, `${name} should have >= 2 nodes, got ${nodeCount}`);
    assert.equal(edgeCount, nodeCount - 1, `${name}: edges should be nodes-1`);
  }
});

test('preset libraries are non-empty and meet minimum variety bar', () => {
  assert.ok(listPresets('ux').length >= 10, 'ux presets >= 10');
  assert.ok(listPresets('ui').length >= 10, 'ui presets >= 10');
  assert.ok(listPresets('engineering').length >= 10, 'engineering presets >= 10');
});

test('renderPreset returns null for unknown categories and unknown names', () => {
  assert.equal(renderPreset('cooking', 'pasta'), null);
  assert.equal(renderPreset('ux', 'no-such-preset'), null);
});

test('engineering and architecture presets are aliased to the same map', () => {
  assert.equal(PRESETS.engineering, PRESETS.architecture);
});
