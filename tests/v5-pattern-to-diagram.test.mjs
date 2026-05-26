/**
 * Tests for `lib/v5/pattern-to-diagram.mjs`.
 *
 * `patternsToUxFlow(patterns, opts)` consumes an array of pattern objects
 * (the output of a research subagent during brainstorming, per §4 of
 * `docs/REFACTOR-REQUIREMENTS.md`) and returns a complete HTML string
 * built on `control/layout/diagrams/ux-flow/template.html`.
 *
 * Each pattern becomes one selectable `.mc-radio-choice` inside the
 * canonical decision-node, so the diagram-select.js helper can recognise
 * the options on save.
 *
 * Stdlib only, node:test runner.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { patternsToUxFlow } from '../lib/v5/pattern-to-diagram.mjs';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ONBOARDING_PATTERNS = [
  {
    name: 'Step Wizard',
    description: 'Linear step-by-step guidance.',
    pros: ['Clear progression', 'Easy to track'],
    cons: ['Feels rigid', 'Skipping is awkward'],
  },
  {
    name: 'Progressive Disclosure',
    description: 'Reveal features as the user encounters them.',
    pros: ['Low friction'],
    cons: ['User may miss features'],
  },
  {
    name: 'Contextual Tooltips',
    description: 'Inline hints attached to UI affordances.',
  },
  {
    name: 'Video Walkthrough',
    description: 'Short embedded tour video.',
    pros: ['Visual'],
    cons: ['Skippable', 'Often ignored'],
  },
];

// ---------------------------------------------------------------------------
// Happy path: HTML contains every pattern
// ---------------------------------------------------------------------------

test('patternsToUxFlow: returns a non-empty HTML document', () => {
  const html = patternsToUxFlow(ONBOARDING_PATTERNS, { slug: 'user-onboarding' });
  assert.equal(typeof html, 'string');
  assert.ok(html.length > 500, 'HTML output should be non-trivial');
  assert.ok(/<!DOCTYPE html>/i.test(html), 'should start with DOCTYPE');
  assert.ok(/<\/html>/i.test(html), 'should close <html>');
});

test('patternsToUxFlow: every pattern name appears in the output', () => {
  const html = patternsToUxFlow(ONBOARDING_PATTERNS, { slug: 'user-onboarding' });
  for (const p of ONBOARDING_PATTERNS) {
    assert.ok(
      html.includes(p.name),
      `expected pattern name "${p.name}" to appear in HTML`,
    );
  }
});

test('patternsToUxFlow: every pattern description appears in the output', () => {
  const html = patternsToUxFlow(ONBOARDING_PATTERNS, { slug: 'user-onboarding' });
  for (const p of ONBOARDING_PATTERNS) {
    assert.ok(
      html.includes(p.description),
      `expected description "${p.description}" to appear in HTML`,
    );
  }
});

// ---------------------------------------------------------------------------
// data-group / data-value attributes (so diagram-select.js sees the options)
// ---------------------------------------------------------------------------

test('patternsToUxFlow: emits a single data-group for the pattern decision', () => {
  const html = patternsToUxFlow(ONBOARDING_PATTERNS, { slug: 'user-onboarding' });
  const groupMatches = html.match(/data-group="[^"]+"/g) || [];
  assert.ok(groupMatches.length >= 1, 'should emit at least one data-group');
});

test('patternsToUxFlow: emits a data-value for every pattern', () => {
  const html = patternsToUxFlow(ONBOARDING_PATTERNS, { slug: 'user-onboarding' });
  const valueMatches = html.match(/data-value="[^"]+"/g) || [];
  // One per pattern; the template's second decision-node placeholder is
  // removed when there are no extra decisions, so the count should be
  // exactly the number of patterns.
  assert.equal(
    valueMatches.length,
    ONBOARDING_PATTERNS.length,
    `expected one data-value per pattern (${ONBOARDING_PATTERNS.length}), got ${valueMatches.length}`,
  );
});

test('patternsToUxFlow: data-value slugs are kebab-case derived from names', () => {
  const html = patternsToUxFlow(ONBOARDING_PATTERNS, { slug: 'user-onboarding' });
  assert.ok(html.includes('data-value="step-wizard"'), 'should slugify "Step Wizard"');
  assert.ok(
    html.includes('data-value="progressive-disclosure"'),
    'should slugify "Progressive Disclosure"',
  );
  assert.ok(
    html.includes('data-value="contextual-tooltips"'),
    'should slugify "Contextual Tooltips"',
  );
  assert.ok(
    html.includes('data-value="video-walkthrough"'),
    'should slugify "Video Walkthrough"',
  );
});

// ---------------------------------------------------------------------------
// HTML escaping (XSS-like input)
// ---------------------------------------------------------------------------

test('patternsToUxFlow: escapes HTML in pattern names and descriptions', () => {
  const xssPatterns = [
    {
      name: '<script>alert("xss")</script>',
      description: 'Mean & nasty <img src=x onerror=alert(1)>',
    },
    {
      name: 'Safe Pattern',
      description: 'Normal description.',
    },
  ];
  const html = patternsToUxFlow(xssPatterns, { slug: 'safety' });
  // The raw <script> tag from input MUST NOT appear unescaped.
  assert.ok(
    !html.includes('<script>alert("xss")</script>'),
    'raw <script> tag from input should be escaped',
  );
  // The <img onerror...> tag must not appear unescaped either.
  assert.ok(
    !html.includes('<img src=x onerror=alert(1)>'),
    'raw <img onerror> tag from input should be escaped',
  );
  // The escaped form should be present.
  assert.ok(
    html.includes('&lt;script&gt;'),
    'should contain escaped form of <script>',
  );
  assert.ok(
    html.includes('&amp;'),
    'should escape the ampersand in "Mean & nasty"',
  );
});

test('patternsToUxFlow: escapes HTML in title/subtitle substitutions', () => {
  const html = patternsToUxFlow(ONBOARDING_PATTERNS, {
    slug: 'x',
    title: 'My <script>title</script>',
    subtitle: 'Tagline <b>bold</b>',
  });
  assert.ok(
    !html.includes('<script>title</script>'),
    'title should be escaped',
  );
  assert.ok(html.includes('&lt;script&gt;title&lt;/script&gt;'));
});

// ---------------------------------------------------------------------------
// Empty patterns array
// ---------------------------------------------------------------------------

test('patternsToUxFlow: empty patterns array returns valid HTML with a placeholder', () => {
  const html = patternsToUxFlow([], { slug: 'empty-feature' });
  assert.equal(typeof html, 'string');
  assert.ok(/<!DOCTYPE html>/i.test(html), 'should still be a complete HTML doc');
  assert.ok(/<\/html>/i.test(html));
  // No selectable patterns means no data-value attributes from patterns.
  const valueMatches = html.match(/data-value="[^"]+"/g) || [];
  assert.equal(valueMatches.length, 0, 'no patterns → no data-value buttons');
  // A human-readable placeholder must appear so the diagram is not blank.
  assert.match(
    html,
    /no patterns yet/i,
    'should include a "no patterns yet" placeholder when patterns is empty',
  );
});

// ---------------------------------------------------------------------------
// Title / subtitle / slug substitution
// ---------------------------------------------------------------------------

test('patternsToUxFlow: substitutes title when provided', () => {
  const html = patternsToUxFlow(ONBOARDING_PATTERNS, {
    slug: 'user-onboarding',
    title: 'User Onboarding — Research Patterns',
  });
  assert.ok(
    html.includes('User Onboarding — Research Patterns'),
    'title should appear in the output',
  );
  assert.ok(
    !html.includes('{{TITLE}}'),
    'all {{TITLE}} placeholders should be substituted',
  );
});

test('patternsToUxFlow: substitutes subtitle when provided', () => {
  const html = patternsToUxFlow(ONBOARDING_PATTERNS, {
    slug: 'user-onboarding',
    subtitle: 'Pick a pattern to anchor the UX flow.',
  });
  assert.ok(html.includes('Pick a pattern to anchor the UX flow.'));
  assert.ok(!html.includes('{{SUBTITLE}}'));
});

test('patternsToUxFlow: substitutes slug into the inline save script', () => {
  const html = patternsToUxFlow(ONBOARDING_PATTERNS, { slug: 'user-onboarding' });
  assert.ok(
    html.includes("'user-onboarding'") || html.includes('"user-onboarding"'),
    'slug should be embedded as a JS string literal in the save script',
  );
  assert.ok(!html.includes('{{SLUG}}'), 'all {{SLUG}} tokens should be substituted');
});

test('patternsToUxFlow: provides safe defaults for title/subtitle when omitted', () => {
  const html = patternsToUxFlow(ONBOARDING_PATTERNS, { slug: 'user-onboarding' });
  // Even without explicit opts, no raw {{...}} tokens should leak.
  assert.ok(
    !/\{\{TITLE\}\}/.test(html),
    'TITLE placeholder must be substituted with a default',
  );
  assert.ok(
    !/\{\{SUBTITLE\}\}/.test(html),
    'SUBTITLE placeholder must be substituted with a default',
  );
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

test('patternsToUxFlow: missing slug throws', () => {
  assert.throws(
    () => patternsToUxFlow(ONBOARDING_PATTERNS, {}),
    /slug/i,
  );
});

test('patternsToUxFlow: non-array patterns throws', () => {
  assert.throws(
    () => patternsToUxFlow(null, { slug: 'x' }),
    /array/i,
  );
  assert.throws(
    () => patternsToUxFlow('not an array', { slug: 'x' }),
    /array/i,
  );
});

// ---------------------------------------------------------------------------
// All placeholders are substituted (no leaked `{{...}}` tokens)
// ---------------------------------------------------------------------------

test('patternsToUxFlow: output contains no unsubstituted {{...}} placeholders', () => {
  const html = patternsToUxFlow(ONBOARDING_PATTERNS, {
    slug: 'user-onboarding',
    title: 'A title',
    subtitle: 'A subtitle',
  });
  const leaked = html.match(/\{\{[A-Z0-9_]+\}\}/g);
  assert.equal(
    leaked,
    null,
    `expected no leaked {{TOKEN}} placeholders, found: ${leaked && leaked.join(', ')}`,
  );
});
