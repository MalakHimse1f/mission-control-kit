/**
 * v5 feature detail HTML renderer.
 *
 * Pure function: takes the bundle from `lib/v5/feature-data.mjs` and returns
 * a complete HTML document as a string. No file IO, no globals.
 *
 * Visual reference: docs/v5-diagrams/07-feature-presentation.html.
 * CSS lives in control/scripts/v5/feature.css (served at /feature.css).
 * Client JS lives in control/scripts/v5/feature-client.js (served at
 * /feature-client.js).
 *
 * Three tabs (UX, UI, Architecture). Each tab renders its decisions as
 * radio-style option cards using the `data-group` / `data-value` convention
 * understood by Task 1's `diagram-select.js`. The card matching the saved
 * selection is server-side marked `.selected` so the page is correct on first
 * paint (no client round-trip).
 */

import {
  renderSpec,
  renderTasks,
  renderPhases,
  renderJournal,
  renderExplore,
  renderWireframes,
} from './render-docs.mjs';

const TAB_ORDER = ['ux', 'ui', 'architecture'];

const DOC_TABS = [
  { key: 'doc-spec', label: 'Spec' },
  { key: 'doc-tasks', label: 'Tasks' },
  { key: 'doc-phases', label: 'Phases' },
  { key: 'doc-journal', label: 'Journal' },
  { key: 'doc-explore', label: 'Explore' },
  { key: 'doc-wireframes', label: 'Wireframes' },
];

const PHASE_STATUS_LABEL = {
  complete: 'Complete',
  'in-progress': 'In progress',
  'not-started': 'Not started',
};

const PHASE_QUESTION_PROMPT = {
  ux: "What's the experience?",
  ui: 'What do the components look like?',
  architecture: 'How does it work under the hood?',
};

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) =>
    ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[ch],
  );
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function escapeJsonForScript(obj) {
  // Inline JSON inside a <script type="application/json"> still needs to
  // avoid prematurely closing the tag. Replace '<' (and unicode separators
  // for safety) inside the literal.
  return JSON.stringify(obj == null ? null : obj)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Humanize a slug like "team-collab" → "Team Collab" for display.
 * Only used as a fallback when status.json has no `feature` name.
 */
function humanizeSlug(slug) {
  return String(slug || '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function renderBreadcrumb(displayName) {
  return `
    <div class="breadcrumb">
      <a href="/">Dashboard</a>
      <span class="sep">→</span>
      <span class="breadcrumb-current">${escapeHtml(displayName)}</span>
    </div>`;
}

function renderHeader({ displayName, description, stageLabel }) {
  const subtitle = description
    ? `<p class="subtitle">${escapeHtml(description)}</p>`
    : '';
  const badge = stageLabel
    ? `<span class="stage-badge">${escapeHtml(stageLabel)}</span>`
    : '';
  return `
    <div class="header">
      <div class="header-row">
        <h1>${escapeHtml(displayName)}</h1>
        ${badge}
      </div>
      ${subtitle}
    </div>`;
}

function renderTabs(tabs, activeKey) {
  const items = TAB_ORDER.map((key, idx) => {
    const tab = tabs[key];
    const isActive = key === activeKey;
    return `
      <button class="tab${isActive ? ' active' : ''}" type="button" data-tab="${escapeAttr(key)}">
        <span class="tab-num">${idx + 1}</span>${escapeHtml(tab.label)}
      </button>`;
  }).join('');
  return `<div class="tabs" role="tablist">${items}\n    </div>`;
}

/**
 * Apply the `.selected` / `aria-checked` / class flag to whichever
 * `mc-option-card` has a matching `data-value` inside a pre-built fragment,
 * stripping any pre-existing `.selected` markers first so server-rendered
 * state always wins over whatever was baked into the fragment file.
 *
 * Uses simple regex transforms — fragments are trusted (live under control/,
 * written by the orchestrator) so no full HTML parser is needed.
 */
function inlineFragment(fragmentHtml, selectedValue) {
  if (typeof fragmentHtml !== 'string' || fragmentHtml.length === 0) return '';
  let html = fragmentHtml;

  // 1) Strip any existing `selected` token from `mc-option-card` class lists.
  html = html.replace(
    /class="(mc-option-card[^"]*)"/g,
    (_match, classes) => {
      const cleaned = classes
        .split(/\s+/)
        .filter((c) => c && c !== 'selected')
        .join(' ');
      return `class="${cleaned}"`;
    },
  );

  // 2) Reset aria-checked on every option card to "false".
  html = html.replace(
    /(<div\b[^>]*class="mc-option-card[^"]*"[^>]*aria-checked=)"(?:true|false)"/g,
    '$1"false"',
  );

  // 3) Add `selected` to the card whose data-value matches selectedValue.
  if (typeof selectedValue === 'string' && selectedValue.length > 0) {
    // Build an HTML-attribute-escaped form of the selected value so we can
    // match it inside data-value="...".
    const escVal = String(selectedValue).replace(/[&<>"']/g, (ch) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[ch],
    );
    const dataAttrRe = new RegExp(
      'data-value="' + escVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"',
    );

    html = html.replace(
      /<div\b([^>]*?)class="(mc-option-card[^"]*)"([^>]*)>/g,
      (match, before, classes, after) => {
        const wholeTag = match;
        if (!dataAttrRe.test(wholeTag)) return match;
        const merged = classes + ' selected';
        // Also flip aria-checked → true on this card.
        let rebuilt = `<div${before}class="${merged}"${after}>`;
        rebuilt = rebuilt.replace(/aria-checked="false"/, 'aria-checked="true"');
        return rebuilt;
      },
    );
  }

  return html;
}

/**
 * Render one decision as a card group with N option cards (radio behavior).
 * Wires the `data-group=decision.id` / `data-value=optionText` convention so
 * Task 1's diagram-select.js picks it up automatically.
 *
 * If the decision carries a pre-built `fragmentHtml` (attached by
 * `loadFeatureData`), the fragment is inlined verbatim and the `.selected`
 * marker is patched to match `decision.selected`. Otherwise, falls back to a
 * text-only card rendering.
 *
 * The card matching `decision.selected` gets the `.selected` class on first
 * paint (no client hydration needed).
 */
function renderDecisionCard(decision) {
  const groupId = decision.id || '';
  const question = decision.question || '';
  const options = Array.isArray(decision.options) ? decision.options : [];
  const selected = decision.selected || '';

  if (typeof decision.fragmentHtml === 'string' && decision.fragmentHtml.length > 0) {
    const fragment = inlineFragment(decision.fragmentHtml, selected);
    return `
      <div class="decision-block">
        <h2 class="section-title">${escapeHtml(question)}</h2>
        ${fragment}
      </div>`;
  }

  const cards = options
    .map((opt) => {
      const isSelected = opt === selected;
      return `
          <div class="option-card${isSelected ? ' selected' : ''}" data-value="${escapeAttr(opt)}" tabindex="0" role="radio" aria-checked="${isSelected ? 'true' : 'false'}">
            <span class="check">✓</span>
            <h3>${escapeHtml(opt)}</h3>
          </div>`;
    })
    .join('');

  return `
      <div class="decision-block">
        <h2 class="section-title">${escapeHtml(question)}</h2>
        <div class="options-grid" data-group="${escapeAttr(groupId)}">${cards}
        </div>
      </div>`;
}

function renderPendingList(pending) {
  if (!Array.isArray(pending) || pending.length === 0) return '';
  const items = pending.map((p) => `<li>${escapeHtml(p)}</li>`).join('');
  return `
      <div class="pending-panel">
        <h4>Pending decisions</h4>
        <ul>${items}</ul>
      </div>`;
}

function renderTabSection(tab, activeKey) {
  const isActive = tab.key === activeKey;
  const empty =
    tab.decisions.length === 0 && tab.pending.length === 0
      ? `
      <div class="empty-tab">
        <p class="muted-text">No ${escapeHtml(tab.label)} decisions yet.</p>
      </div>`
      : '';
  const decisionBlocks = tab.decisions.map(renderDecisionCard).join('');
  const pending = renderPendingList(tab.pending);
  return `
    <div class="section${isActive ? ' visible' : ''}" id="section-${escapeAttr(tab.key)}" data-tab-section="${escapeAttr(tab.key)}" role="tabpanel">
      <div class="section-meta">
        <span class="phase-status phase-status-${escapeAttr(tab.status)}">${escapeHtml(tab.statusLabel)}</span>
        <span class="phase-prompt">${escapeHtml(PHASE_QUESTION_PROMPT[tab.key] || '')}</span>
      </div>${empty}${decisionBlocks}${pending}
    </div>`;
}

function renderTopTabs() {
  return `
    <nav class="top-tabs" role="tablist" aria-label="Feature view">
      <button class="top-tab active" type="button" data-top-tab="decisions" aria-selected="true">Decisions</button>
      <button class="top-tab" type="button" data-top-tab="documentation" aria-selected="false">Documentation</button>
    </nav>`;
}

function renderDocSubTabs() {
  const items = DOC_TABS.map((t, idx) => {
    const isActive = idx === 0;
    return `
      <button class="tab${isActive ? ' active' : ''}" type="button" data-tab="${escapeAttr(t.key)}">
        ${escapeHtml(t.label)}
      </button>`;
  }).join('');
  return `<div class="tabs" role="tablist">${items}\n      </div>`;
}

function renderDocumentationSection(docs) {
  const safeDocs = docs && typeof docs === 'object' ? docs : {};
  const sections = [
    { key: 'doc-spec', html: renderSpec(safeDocs.spec) },
    { key: 'doc-tasks', html: renderTasks(safeDocs.tasks) },
    { key: 'doc-phases', html: renderPhases(safeDocs.phases) },
    { key: 'doc-journal', html: renderJournal(safeDocs.journal) },
    { key: 'doc-explore', html: renderExplore(safeDocs.explore) },
    { key: 'doc-wireframes', html: renderWireframes(safeDocs.wireframes) },
  ]
    .map((s, idx) => {
      const isActive = idx === 0;
      return `
      <div class="section${isActive ? ' visible' : ''}" data-tab-section="${escapeAttr(s.key)}" role="tabpanel">${s.html}
      </div>`;
    })
    .join('');
  return `
    <section class="top-section" data-top-tab="documentation">
      ${renderDocSubTabs()}
${sections}
    </section>`;
}

function renderBottomBar() {
  return `
  <div class="bottom-bar">
    <div class="bottom-inner">
      <a href="/" class="link-next">← Back to dashboard</a>
      <button class="btn-save" type="button" id="btn-save" data-mc-save>Save All Decisions</button>
    </div>
  </div>`;
}

function renderToast() {
  return `
  <div class="toast" id="toast" role="status" aria-live="polite">
    <span class="toast-icon">✓</span>
    <span class="toast-message">Decisions saved</span>
  </div>`;
}

/**
 * Pick the most useful "active" tab on first paint:
 *   - If any phase is in-progress, focus that.
 *   - Else if any has pending, focus that.
 *   - Else default to architecture (matches the mockup default).
 */
function pickInitialTab(tabs) {
  for (const key of TAB_ORDER) {
    if (tabs[key] && tabs[key].status === 'in-progress') return key;
  }
  for (const key of TAB_ORDER) {
    if (tabs[key] && tabs[key].pending && tabs[key].pending.length > 0) return key;
  }
  return 'architecture';
}

/**
 * Render the full per-feature HTML document.
 *
 * @param {{ slug: string, data: object }} args
 *   - slug: feature slug (used for the title bar, API endpoints, etc.)
 *   - data: bundle from loadFeatureData
 * @returns {string}
 */
export function renderFeature({ slug, data } = {}) {
  if (!slug || typeof slug !== 'string') {
    throw new Error('renderFeature: slug is required');
  }
  if (!data || typeof data !== 'object') {
    throw new Error('renderFeature: data is required');
  }

  const status = data.status || {};
  const tabs = data.tabs || {};
  const displayName =
    (status.feature && String(status.feature)) || humanizeSlug(slug);
  const description = status.description ? String(status.description) : '';
  const activeKey = pickInitialTab(tabs);
  const stageLabel = tabs[activeKey]
    ? `${tabs[activeKey].label} • ${tabs[activeKey].statusLabel}`
    : '';

  const sections = TAB_ORDER.map((key) => renderTabSection(tabs[key], activeKey)).join('');

  // Hidden state for the client: full decisions blob, slug, and initial
  // selections by group id. Client merges current selections back onto this
  // before POST so unrelated phases aren't wiped.
  const initialSelections = {};
  for (const key of TAB_ORDER) {
    const tab = tabs[key];
    if (!tab) continue;
    for (const d of tab.decisions) {
      if (d && d.id && d.selected) initialSelections[d.id] = d.selected;
    }
  }
  const state = {
    slug,
    decisions: data.decisions || null,
    initialSelections,
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mission Control Kit v5 — ${escapeHtml(displayName)}</title>
  <link rel="stylesheet" href="/feature.css" />
  <link rel="stylesheet" href="/diagrams/_shared/diagram.css" />
</head>
<body>
  <div class="container">${renderBreadcrumb(displayName)}${renderHeader({ displayName, description, stageLabel })}
${renderTopTabs()}

    <section class="top-section visible" data-top-tab="decisions">
      ${renderTabs(tabs, activeKey)}
${sections}
    </section>
${renderDocumentationSection(data.docs)}
  </div>
${renderBottomBar()}
${renderToast()}
  <script type="application/json" id="mc-feature-state">${escapeJsonForScript(state)}</script>
  <script src="/diagrams/_shared/diagram-select.js" defer></script>
  <script src="/diagrams/_shared/decisions-client.js" defer></script>
  <script src="/feature-client.js" defer></script>
</body>
</html>
`;
}

// Exported for tests
export const __test__ = { escapeHtml, escapeJsonForScript, humanizeSlug, pickInitialTab, inlineFragment };
