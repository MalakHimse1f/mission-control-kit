/**
 * v5 brainstorming helper — transform research patterns into a UX flow
 * diagram HTML page.
 *
 * Implements §4 (Brainstorming Flow Enhancement) of
 * `docs/REFACTOR-REQUIREMENTS.md`. Canonical sequence is illustrated in
 * `docs/v5-diagrams/04-brainstorming-ux-flow.html`:
 *
 *   1. Orchestrator scopes the feature.
 *   2. Orchestrator ALWAYS offers research.
 *   3. Research subagent returns patterns.
 *   4. THIS HELPER turns those patterns into a selectable UX-flow diagram.
 *   5. Caller writes the HTML to `control/v5/features/{slug}/ux-flow.html`
 *      and auto-launches the dashboard via `lib/v5/auto-launch.mjs`.
 *
 * Why this is a pure function: it returns a string, never writes to disk.
 * That keeps it trivially testable and keeps the orchestrator skill in
 * charge of where the file lands. The skill body (`skills/mc-v5-brainstorm`)
 * documents the wiring.
 *
 * Stdlib only. No external dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_TEMPLATE_REL = 'control/layout/diagrams/ux-flow/template.html';

/**
 * @typedef {object} Pattern
 * @property {string} name        Human-readable pattern name (e.g. "Step Wizard").
 * @property {string} description One-line description.
 * @property {string[]} [pros]    Optional pros list (not rendered in the
 *                                radio label itself; future Task may surface
 *                                them in a pros/cons popover).
 * @property {string[]} [cons]    Optional cons list (same).
 */

/**
 * @typedef {object} PatternsToUxFlowOpts
 * @property {string}  slug              Feature slug. Required — substituted
 *                                       into the inline save script.
 * @property {string} [title]            Title for the diagram. Default:
 *                                       "Research Patterns — {slug}".
 * @property {string} [subtitle]         One-sentence framing. Default:
 *                                       "Pick the pattern that best fits the
 *                                       feature you described."
 * @property {string} [sectionLabel]     Small-caps section label. Default:
 *                                       "UX FLOW — RESEARCH PATTERNS".
 * @property {string} [decisionTitle]    Heading for the decision node.
 *                                       Default: "Pattern Selection".
 * @property {string} [decisionContext]  Sub-heading explaining the decision.
 *                                       Default: "Choose one pattern to
 *                                       anchor the UX flow.".
 * @property {string} [decisionGroupId]  data-group id. Default: "pattern".
 * @property {string} [templatePath]     Absolute path to the ux-flow
 *                                       template. Auto-resolved by walking up
 *                                       from this module's directory.
 */

/**
 * Build a UX-flow diagram HTML page from an array of research patterns.
 *
 * @param {Pattern[]} patterns
 * @param {PatternsToUxFlowOpts} opts
 * @returns {string} A complete standalone HTML document.
 */
export function patternsToUxFlow(patterns, opts = {}) {
  if (!Array.isArray(patterns)) {
    throw new TypeError(
      'patternsToUxFlow: patterns must be an array of {name, description, pros?, cons?} objects',
    );
  }
  if (!opts || !opts.slug) {
    throw new Error('patternsToUxFlow: opts.slug is required');
  }

  const slug = String(opts.slug);
  const title = opts.title || `Research Patterns — ${slug}`;
  const subtitle =
    opts.subtitle ||
    'Pick the pattern that best fits the feature you described.';
  const sectionLabel = opts.sectionLabel || 'UX FLOW — RESEARCH PATTERNS';
  const decisionTitle = opts.decisionTitle || 'Pattern Selection';
  const decisionContext =
    opts.decisionContext || 'Choose one pattern to anchor the UX flow.';
  const decisionGroupId = opts.decisionGroupId || 'pattern';

  const templatePath = opts.templatePath || resolveTemplatePath();
  const template = fs.readFileSync(templatePath, 'utf8');

  // Build the radio choices for the first decision node from the patterns.
  // When patterns is empty we render a placeholder so the diagram is not
  // visually broken — this preserves the §4 contract that "diagrams are
  // saved and embedded in the dashboard" even before research finishes.
  const optionsHtml =
    patterns.length === 0
      ? buildEmptyState()
      : buildOptionsHtml(patterns);

  // Build the timeline labels from the canonical brainstorming sequence
  // (see diagram 04). These are the user-visible step labels.
  const steps = [
    { icon: '💡', label: 'Scope feature' },
    { icon: '🔎', label: 'Offer research' },
    { icon: '⟳', label: 'Research patterns' },
    { icon: '◫', label: 'Review diagram' },
    { icon: '✓', label: 'Save decision' },
  ];

  // Substitute every placeholder. Order matters only for readability — each
  // token appears in independent spots in the template.
  let html = template;

  // Header / section
  html = replaceAll(html, '{{TITLE}}', escapeHtml(title));
  html = replaceAll(html, '{{SUBTITLE}}', escapeHtml(subtitle));
  html = replaceAll(html, '{{SECTION_LABEL}}', escapeHtml(sectionLabel));

  // Timeline steps (5 fixed positions in the template).
  for (let i = 0; i < steps.length; i++) {
    html = replaceAll(html, `{{STEP_${i + 1}_ICON}}`, escapeHtml(steps[i].icon));
    html = replaceAll(html, `{{STEP_${i + 1}_LABEL}}`, escapeHtml(steps[i].label));
  }

  // Decision node 1 — the pattern selection produced from research.
  // We rewrite the entire .mc-decision-node block so we can emit a
  // variable number of options (one per pattern). The template ships
  // with three static option tokens; substituting the whole block lets
  // us hit any pattern count cleanly.
  html = rewriteDecisionNode(html, {
    decisionTitle,
    decisionContext,
    decisionGroupId,
    optionsHtml,
  });

  // The template has a second decision node for the future "follow-up"
  // question. During brainstorming we only have one pattern decision, so
  // we strip the second node entirely. Future iterations can re-introduce
  // it once the post-pattern questions are formalised.
  html = stripSecondDecisionNode(html);

  // Inline save script — substitute the feature slug.
  html = replaceAll(html, '{{SLUG}}', escapeJsString(slug));

  return html;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Walk up from this module's directory to find the repo root, then resolve
 * the canonical ux-flow template path. Mirrors the pattern used by
 * `lib/v5/server-port.mjs` for `control/` discovery.
 *
 * @returns {string} absolute path to `control/layout/diagrams/ux-flow/template.html`
 */
function resolveTemplatePath() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // The module lives at <repo>/lib/v5/pattern-to-diagram.mjs.
  // Walk up looking for `control/layout/diagrams/ux-flow/template.html`.
  let dir = here;
  for (let i = 0; i < 64; i++) {
    const candidate = path.join(dir, DEFAULT_TEMPLATE_REL);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `patternsToUxFlow: could not locate ${DEFAULT_TEMPLATE_REL} by walking up from ${here}. ` +
      'Pass opts.templatePath explicitly.',
  );
}

/**
 * Build the HTML for one `.mc-radio-choice` per pattern. The first option is
 * pre-selected — the user can change it before saving.
 *
 * @param {Pattern[]} patterns
 * @returns {string}
 */
function buildOptionsHtml(patterns) {
  return patterns
    .map((pattern, index) => {
      const name = pattern && pattern.name ? String(pattern.name) : '(unnamed)';
      const description =
        pattern && pattern.description ? String(pattern.description) : '';
      const optionId = slugify(name) || `pattern-${index + 1}`;
      const isSelected = index === 0;
      const selectedClass = isSelected ? ' selected' : '';
      const descSpan = description
        ? `\n        <span class="mc-radio-description">${escapeHtml(description)}</span>`
        : '';
      return (
        `      <button type="button" class="mc-radio-choice${selectedClass}" data-value="${escapeHtmlAttr(optionId)}">\n` +
        `        <span class="mc-radio-dot"></span>\n` +
        `        ${escapeHtml(name)}${descSpan}\n` +
        `      </button>`
      );
    })
    .join('\n\n');
}

/**
 * Placeholder used when the research subagent has not yet returned patterns
 * (or returned an empty list). The diagram is still rendered so the
 * dashboard can show "no patterns yet" instead of a blank panel.
 */
function buildEmptyState() {
  return (
    '      <p class="mc-radio-empty">No patterns yet — research has not produced any options. ' +
    'Re-run the brainstorm with research enabled.</p>'
  );
}

/**
 * Rewrite the first `.mc-decision-node` block in the template so its title,
 * context, group id, and options come from our inputs. We replace the entire
 * block instead of doing surgical token swaps because the template has a
 * fixed three-option structure and we need to support any pattern count.
 *
 * @param {string} html
 * @param {{decisionTitle: string, decisionContext: string, decisionGroupId: string, optionsHtml: string}} parts
 * @returns {string}
 */
function rewriteDecisionNode(html, parts) {
  const block =
    `<div class="mc-decision-node">\n` +
    `    <h4>${escapeHtml(parts.decisionTitle)}</h4>\n` +
    `    <p class="mc-decision-context">${escapeHtml(parts.decisionContext)}</p>\n\n` +
    `    <div class="mc-radio-list" data-group="${escapeHtmlAttr(parts.decisionGroupId)}" data-category="ux">\n\n` +
    `${parts.optionsHtml}\n\n` +
    `      <!-- PLACEHOLDER:DECISION_1_EXTRA_OPTIONS — add more .mc-radio-choice as needed -->\n` +
    `    </div>\n` +
    `  </div>`;

  // The template opens the first decision node with literally this line
  // and closes it with `  </div>` followed by the PLACEHOLDER:DECISION_2
  // comment. We replace from the opening tag to that comment marker
  // (exclusive of the comment).
  const startMarker = '<div class="mc-decision-node">';
  const endMarker = '<!-- PLACEHOLDER:DECISION_2';
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker, startIdx);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(
      'patternsToUxFlow: ux-flow template did not contain the expected ' +
        'decision-node markers. Has control/layout/diagrams/ux-flow/template.html changed?',
    );
  }
  return html.slice(0, startIdx) + block + '\n\n  ' + html.slice(endIdx);
}

/**
 * Remove the second decision-node block (the one after PLACEHOLDER:DECISION_2).
 * The block is bounded by the `PLACEHOLDER:DECISION_2` comment opening it and
 * the `.mc-save-bar` div that follows.
 *
 * @param {string} html
 * @returns {string}
 */
function stripSecondDecisionNode(html) {
  const startMarker = '<!-- PLACEHOLDER:DECISION_2';
  const endMarker = '<div class="mc-save-bar">';
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker, startIdx);
  if (startIdx === -1 || endIdx === -1) return html;
  return html.slice(0, startIdx) + html.slice(endIdx);
}

/**
 * Slugify a string into kebab-case: lowercase, alphanumerics and hyphens
 * only, collapsed hyphens, no leading/trailing hyphen.
 *
 * @param {string} input
 * @returns {string}
 */
function slugify(input) {
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Replace every occurrence of a literal token in a string. Avoids regex so
 * the replacement is never interpreted as a backreference (`$1`, etc.).
 *
 * @param {string} haystack
 * @param {string} needle
 * @param {string} replacement
 * @returns {string}
 */
function replaceAll(haystack, needle, replacement) {
  if (!needle) return haystack;
  return haystack.split(needle).join(replacement);
}

/**
 * Escape characters that have meaning in HTML text content.
 *
 * @param {string} input
 * @returns {string}
 */
function escapeHtml(input) {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape for use inside a double-quoted HTML attribute. Same as escapeHtml,
 * but separated by intent — callers should reach for this when interpolating
 * into `attr="..."` to make the call site obvious.
 *
 * @param {string} input
 * @returns {string}
 */
function escapeHtmlAttr(input) {
  return escapeHtml(input);
}

/**
 * Escape for use inside a single-quoted JS string literal. The template
 * embeds `'{{SLUG}}'` in an inline `<script>` block, so we must prevent
 * embedded apostrophes or backslashes from terminating the literal.
 *
 * @param {string} input
 * @returns {string}
 */
function escapeJsString(input) {
  return String(input)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/</g, '\\u003c'); // defeat </script> in the literal
}
