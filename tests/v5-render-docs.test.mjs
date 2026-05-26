/**
 * Tests for control/scripts/v5/render-docs.mjs — feature doc renderers.
 *
 * Pure functions, no IO. Each renderer is tested for:
 *   - empty input → empty-state HTML
 *   - non-empty input → expected classes / structure
 *   - HTML escaping of user content
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  renderSpec,
  renderTasks,
  renderPhases,
  renderJournal,
  renderExplore,
  renderWireframes,
} from '../control/scripts/v5/render-docs.mjs';

// ---------------------------------------------------------------------------
// renderSpec
// ---------------------------------------------------------------------------

test('renderSpec returns empty-state for missing spec', () => {
  const html = renderSpec({ exists: false, content: '', path: '' });
  assert.match(html, /class="doc-empty"/);
  assert.match(html, /No spec yet/);
});

test('renderSpec wraps content in doc-md article with <pre>', () => {
  const html = renderSpec({ exists: true, content: '# Hello\n\nLine 2' });
  assert.match(html, /class="doc-md"/);
  assert.match(html, /<pre>/);
  assert.match(html, /# Hello/);
  // Newline preserved literally inside the <pre> (no <br>, no markdown conversion).
  assert.ok(html.includes('# Hello\n\nLine 2'));
});

test('renderSpec escapes HTML in spec content', () => {
  const html = renderSpec({ exists: true, content: '<script>alert(1)</script>' });
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

// ---------------------------------------------------------------------------
// renderTasks
// ---------------------------------------------------------------------------

test('renderTasks returns empty-state for empty list', () => {
  const html = renderTasks([]);
  assert.match(html, /class="doc-empty"/);
  assert.match(html, /No tasks recorded yet/);
});

test('renderTasks groups by status with counts', () => {
  const tasks = [
    { id: '1', title: 'Done one', status: 'done' },
    { id: '2', title: 'Done two', status: 'done' },
    { id: '3', title: 'Working', status: 'in-progress' },
    { id: '4', title: 'Pending one', status: 'pending' },
  ];
  const html = renderTasks(tasks);
  assert.match(html, /class="doc-tasks"/);
  assert.match(html, /data-status="done"/);
  assert.match(html, /data-status="in-progress"/);
  assert.match(html, /data-status="pending"/);
  assert.match(html, /Done \(2\)/);
  assert.match(html, /In progress \(1\)/);
  assert.match(html, /Pending \(1\)/);
  assert.match(html, /Done one/);
  assert.match(html, /Working/);
});

test('renderTasks renders 7-char short commit hash as commit-link', () => {
  const tasks = [
    { id: '1', title: 'Done', status: 'done', commit: 'abcdef1234567890' },
  ];
  const html = renderTasks(tasks);
  assert.match(html, /class="commit-link"/);
  assert.match(html, />abcdef1</);
  // Full hash should NOT appear (only first 7 chars).
  assert.ok(!html.includes('abcdef1234567890'));
});

test('renderTasks escapes HTML in task titles and statuses', () => {
  const tasks = [
    { id: '1', title: '<img src=x onerror=alert(1)>', status: 'done' },
  ];
  const html = renderTasks(tasks);
  assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('renderTasks puts unknown statuses under "Other" group', () => {
  const tasks = [{ id: '1', title: 'Weird', status: 'blocked' }];
  const html = renderTasks(tasks);
  assert.match(html, /data-status="other"/);
  assert.match(html, /Other \(1\)/);
});

// ---------------------------------------------------------------------------
// renderPhases
// ---------------------------------------------------------------------------

test('renderPhases returns empty-state for empty list', () => {
  const html = renderPhases([]);
  assert.match(html, /class="doc-empty"/);
  assert.match(html, /No phase plans yet/);
});

test('renderPhases renders <details> per phase, first one open', () => {
  const phases = [
    { file: 'phase-1.md', label: 'phase-1', content: 'P1 content' },
    { file: 'phase-2.md', label: 'phase-2', content: 'P2 content' },
  ];
  const html = renderPhases(phases);
  // First open, second closed.
  const matches = html.match(/<details class="doc-disclosure"( open)?>/g) || [];
  assert.equal(matches.length, 2);
  assert.equal(matches[0], '<details class="doc-disclosure" open>');
  assert.equal(matches[1], '<details class="doc-disclosure">');
  assert.match(html, /<summary>phase-1<\/summary>/);
  assert.match(html, /P1 content/);
});

test('renderPhases escapes HTML in content', () => {
  const phases = [{ file: 'p.md', label: 'p', content: '<script>x</script>' }];
  const html = renderPhases(phases);
  assert.ok(!html.includes('<script>x</script>'));
  assert.match(html, /&lt;script&gt;x&lt;\/script&gt;/);
});

// ---------------------------------------------------------------------------
// renderJournal
// ---------------------------------------------------------------------------

test('renderJournal returns empty-state for empty list', () => {
  const html = renderJournal([]);
  assert.match(html, /class="doc-empty"/);
  assert.match(html, /No journal entries yet/);
});

test('renderJournal renders disclosures with first one open', () => {
  const entries = [
    { file: '001-first.md', label: 'First', content: 'first content' },
    { file: '002-second.md', label: 'Second', content: 'second content' },
  ];
  const html = renderJournal(entries);
  assert.match(html, /<details class="doc-disclosure" open><summary>First<\/summary>/);
  assert.match(html, /<details class="doc-disclosure"><summary>Second<\/summary>/);
});

test('renderJournal escapes HTML in content and label', () => {
  const entries = [{ file: 'x.md', label: '<x>', content: '<svg/onload=alert(1)>' }];
  const html = renderJournal(entries);
  assert.ok(!html.includes('<svg/onload=alert(1)>'));
  assert.match(html, /&lt;svg/);
  assert.match(html, /&lt;x&gt;/);
});

// ---------------------------------------------------------------------------
// renderExplore
// ---------------------------------------------------------------------------

test('renderExplore returns empty-state for empty list', () => {
  const html = renderExplore([]);
  assert.match(html, /class="doc-empty"/);
  assert.match(html, /No exploration docs yet/);
});

test('renderExplore renders iframe with srcdoc + sandbox for html items', () => {
  const items = [{ name: 'arch-diagram', format: 'html', content: '<h1>Diagram</h1>' }];
  const html = renderExplore(items);
  assert.match(html, /class="doc-iframe"/);
  assert.match(html, /sandbox="allow-same-origin"/);
  assert.match(html, /srcdoc="/);
  // The HTML content gets attribute-escaped so it doesn't break the srcdoc.
  assert.match(html, /srcdoc="&lt;h1&gt;Diagram&lt;\/h1&gt;"/);
  // Name appears in a heading.
  assert.match(html, /<h3>arch-diagram<\/h3>/);
});

test('renderExplore renders md items as disclosures with <pre>', () => {
  const items = [{ name: 'notes', format: 'md', content: '# Notes' }];
  const html = renderExplore(items);
  assert.match(html, /class="doc-explore-item"/);
  assert.match(html, /<details class="doc-disclosure">/);
  assert.match(html, /<summary>notes<\/summary>/);
  assert.match(html, /<pre class="doc-md"># Notes<\/pre>/);
});

test('renderExplore escapes name (XSS in basename)', () => {
  const items = [{ name: '<bad>', format: 'md', content: 'x' }];
  const html = renderExplore(items);
  assert.ok(!html.includes('<bad>'));
  assert.match(html, /&lt;bad&gt;/);
});

// ---------------------------------------------------------------------------
// renderWireframes
// ---------------------------------------------------------------------------

test('renderWireframes returns empty-state for empty list', () => {
  const html = renderWireframes([]);
  assert.match(html, /class="doc-empty"/);
  assert.match(html, /No wireframes yet/);
});

test('renderWireframes renders a grid of iframe-card with sandbox', () => {
  const items = [
    { id: 'home', label: 'home', html: '<h1>home</h1>' },
    { id: 'detail-view', label: 'detail view', html: '<h1>detail</h1>' },
  ];
  const html = renderWireframes(items);
  assert.match(html, /class="doc-wireframes-grid"/);
  // Two iframe-card entries.
  const cardMatches = html.match(/class="iframe-card"/g) || [];
  assert.equal(cardMatches.length, 2);
  // Sandbox attribute present on the iframes.
  const sandboxMatches = html.match(/sandbox="allow-same-origin"/g) || [];
  assert.equal(sandboxMatches.length, 2);
  // Labels appear in h4.
  assert.match(html, /<h4>home<\/h4>/);
  assert.match(html, /<h4>detail view<\/h4>/);
  // Srcdoc contains escaped HTML.
  assert.match(html, /srcdoc="&lt;h1&gt;home&lt;\/h1&gt;"/);
});

test('renderWireframes escapes label even if it has HTML', () => {
  const items = [{ id: 'evil', label: '<bad>', html: '<h1>x</h1>' }];
  const html = renderWireframes(items);
  assert.ok(!html.includes('<h4><bad></h4>'));
  assert.match(html, /<h4>&lt;bad&gt;<\/h4>/);
});
