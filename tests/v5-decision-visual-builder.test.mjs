/**
 * Tests for lib/v5/decision-visual-builder.mjs
 *
 * Verifies that buildVisualFragment produces the right shell + visual
 * primitives for each category and respects per-option overrides.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildVisualFragment,
  escapeHtml,
} from '../lib/v5/decision-visual-builder.mjs';

test('buildVisualFragment requires a decision object', () => {
  assert.throws(() => buildVisualFragment(null), /decision/);
  assert.throws(() => buildVisualFragment(), /decision/);
});

test('buildVisualFragment for ui category renders mc-mini-frame mockups', () => {
  const decision = {
    id: 'ui-surface',
    category: 'ui',
    question: 'Where does the import flow live?',
    options: ['Dedicated page', 'Settings tab', 'Modal flow'],
    selected: 'Dedicated page',
  };
  const html = buildVisualFragment(decision);

  // Top-level grid attributes
  assert.match(html, /class="mc-options-grid"/);
  assert.match(html, /data-group="ui-surface"/);
  assert.match(html, /data-category="ui"/);
  assert.match(html, /data-question="Where does the import flow live\?"/);

  // Each option produces a card with the expected data-value
  for (const opt of decision.options) {
    assert.ok(
      html.includes(`data-value="${opt}"`),
      `expected card for option "${opt}"`,
    );
  }
  // Mini-frame mockup primitive
  assert.match(html, /mc-mini-frame/);

  // Three cards total
  const matches = html.match(/class="mc-option-card[^"]*"/g) || [];
  assert.equal(matches.length, 3);
});

test('buildVisualFragment for engineering category renders mc-arch-node diagrams', () => {
  const decision = {
    id: 'arch-transport',
    category: 'engineering',
    question: 'What transport?',
    options: ['WebSocket', 'SSE', 'WebRTC'],
    selected: 'WebSocket',
  };
  const html = buildVisualFragment(decision);

  assert.match(html, /data-category="engineering"/);
  assert.match(html, /mc-arch-node/);
  assert.match(html, /mc-diagram-surface/);

  // Selected card carries .selected
  assert.match(
    html,
    /class="mc-option-card selected"[^>]*data-value="WebSocket"/,
  );
});

test('buildVisualFragment for ux category renders mc-flow-step blocks', () => {
  const decision = {
    id: 'ux-picker',
    category: 'ux',
    question: 'How does the user pick?',
    options: ['Wizard', 'Dropzone', 'Source list'],
    selected: 'Wizard',
  };
  const html = buildVisualFragment(decision);

  assert.match(html, /data-category="ux"/);
  assert.match(html, /mc-flow-step/);
  assert.match(html, /mc-flow-timeline/);
});

test('buildVisualFragment for unknown category falls back to a generic visual', () => {
  const decision = {
    id: 'misc',
    category: 'something-else',
    question: 'Pick one',
    options: ['A', 'B'],
    selected: '',
  };
  const html = buildVisualFragment(decision);
  // Still produces a grid + cards
  assert.match(html, /class="mc-options-grid"/);
  assert.equal((html.match(/class="mc-option-card[^"]*"/g) || []).length, 2);
});

test('buildVisualFragment escapes HTML in option labels and question text', () => {
  const decision = {
    id: 'evil',
    category: 'ui',
    question: '<script>alert(1)</script>',
    options: ['<img src=x onerror=alert(2)>', '"><svg/onload=alert(3)>'],
    selected: '<img src=x onerror=alert(2)>',
  };
  const html = buildVisualFragment(decision);

  // Question is in an attribute — must be escaped
  assert.ok(!html.includes('<script>alert(1)</script>'));
  // Raw img/svg attack payloads must not appear in the option labels.
  assert.ok(!/<img src=x onerror=alert\(2\)>/.test(html));
  assert.ok(!/<svg\/onload=alert\(3\)>/.test(html));
  // But the (escaped) data-value still encodes the original string so the
  // round-trip back to decisions.json works.
  assert.ok(html.includes('data-value="&lt;img src=x onerror=alert(2)&gt;"'));
});

test('buildVisualFragment uses optionVisuals override per option', () => {
  const decision = {
    id: 'ui-progress-display',
    category: 'ui',
    question: 'Progress display?',
    options: ['Inline bar', 'Toast', 'Blocking modal'],
    selected: 'Toast',
  };
  const html = buildVisualFragment(decision, {
    optionVisuals: {
      Toast: { content: '<div class="custom-toast-mock">TOAST</div>' },
    },
  });

  assert.match(html, /<div class="custom-toast-mock">TOAST<\/div>/);
  // Other options still get the default UI mockup
  assert.match(html, /mc-mini-frame/);
});

test('buildVisualFragment renders mc-card-label for each option', () => {
  const decision = {
    id: 'ui-test',
    category: 'ui',
    question: 'Q?',
    options: ['Alpha — first option', 'Beta — second option'],
  };
  const html = buildVisualFragment(decision);
  // Label is derived from the leading text before the em-dash.
  assert.ok(html.includes('<div class="mc-card-label">Alpha</div>'));
  assert.ok(html.includes('<div class="mc-card-label">Beta</div>'));
  // Description comes from the trailing portion.
  assert.match(html, /<div class="mc-card-desc">first option<\/div>/);
});

test('buildVisualFragment keeps plain hyphens in labels (no aggressive splitting)', () => {
  const decision = {
    id: 'ui-test2',
    category: 'ui',
    question: 'Q?',
    options: ['Auto-detect file type', 'Manual upload only'],
  };
  const html = buildVisualFragment(decision);
  // "Auto-detect" should not split on the hyphen.
  assert.ok(html.includes('<div class="mc-card-label">Auto-detect file type</div>'));
  assert.ok(html.includes('<div class="mc-card-label">Manual upload only</div>'));
});

// ---------------------------------------------------------------------------
// v5.1 — sidecar (preset / diagram / raw) resolution
// ---------------------------------------------------------------------------

test('buildVisualFragment resolves a sidecar preset per option', () => {
  const decision = {
    id: 'ux-onboarding',
    category: 'ux',
    question: 'Onboarding shape?',
    options: ['Wizard', 'Approval'],
  };
  const html = buildVisualFragment(decision, {
    optionVisuals: {
      Wizard: { preset: 'wizard-3step' },
      Approval: { preset: 'approval' },
    },
  });
  // Both option cards should be backed by a flow-timeline preset.
  assert.equal((html.match(/mc-flow-timeline/g) || []).length, 2);
  // wizard-3step ends with "Confirm"; approval ends with "Approve".
  assert.match(html, />Confirm</);
  assert.match(html, />Approve</);
});

test('buildVisualFragment resolves a sidecar structured diagram per option', () => {
  const decision = {
    id: 'arch-import',
    category: 'engineering',
    question: 'Import backend?',
    options: ['Direct', 'Queued'],
  };
  const html = buildVisualFragment(decision, {
    optionVisuals: {
      Direct: {
        diagram: {
          nodes: [
            { id: 'client', kind: 'client', label: 'Client' },
            { id: 'api', kind: 'service', label: 'API' },
            { id: 'db', kind: 'db', label: 'Store' },
          ],
          edges: [
            { from: 'client', to: 'api', kind: 'sync' },
            { from: 'api', to: 'db', kind: 'data' },
          ],
        },
      },
      Queued: {
        diagram: {
          nodes: [
            { id: 'client', kind: 'client', label: 'Client' },
            { id: 'q', kind: 'queue', label: 'Jobs' },
            { id: 'worker', kind: 'worker', label: 'Worker' },
            { id: 'db', kind: 'db', label: 'Store' },
          ],
          edges: [
            { from: 'client', to: 'q', kind: 'async' },
            { from: 'q', to: 'worker', kind: 'async' },
            { from: 'worker', to: 'db', kind: 'data' },
          ],
        },
      },
    },
  });
  // Each option is its own diagram surface; together that's 2 surfaces, 7 nodes.
  assert.equal((html.match(/mc-diagram-surface/g) || []).length, 2);
  assert.match(html, /mc-arch-node queue/);
  assert.match(html, /mc-arch-node worker/);
  assert.match(html, /mc-arch-edge async/);
});

test('buildVisualFragment accepts a sidecar raw escape hatch', () => {
  const decision = {
    id: 'ui-custom',
    category: 'ui',
    question: 'Custom?',
    options: ['Special'],
  };
  const html = buildVisualFragment(decision, {
    optionVisuals: {
      Special: { raw: '<div class="bespoke-svg-thing">x</div>' },
    },
  });
  assert.match(html, /<div class="bespoke-svg-thing">x<\/div>/);
});

test('buildVisualFragment falls back to legacy rotation when sidecar is empty', () => {
  // No optionVisuals at all — should not throw, should fall back to mockups.
  const decision = {
    id: 'ui-no-sidecar',
    category: 'ui',
    question: 'Q?',
    options: ['A', 'B'],
  };
  const html = buildVisualFragment(decision);
  assert.match(html, /mc-mini-frame/, 'legacy mockup variant should still render');
});

test('buildVisualFragment falls back to legacy when sidecar entry has unknown preset', () => {
  const decision = {
    id: 'ux-unknown-preset',
    category: 'ux',
    question: 'Q?',
    options: ['One'],
  };
  const html = buildVisualFragment(decision, {
    optionVisuals: { One: { preset: 'no-such-preset' } },
  });
  // Falls through to defaultUxVisual (mc-flow-timeline) — still renders.
  assert.match(html, /mc-flow-timeline/);
});

test('escapeHtml escapes all five HTML special chars', () => {
  assert.equal(escapeHtml('<>&"\''), '&lt;&gt;&amp;&quot;&#39;');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});
