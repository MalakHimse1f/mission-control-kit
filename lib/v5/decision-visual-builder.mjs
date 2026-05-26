/**
 * v5 decision visual fragment builder.
 *
 * Given a decision object from decisions.json, produce an HTML fragment that
 * renders that decision as a visual `.mc-options-grid` (one `.mc-option-card`
 * per option) using the diagram primitives in
 * `control/layout/diagrams/{architecture,ux-flow,ui-options}/template.html`.
 *
 * The fragment is meant to be inlined into the feature detail page, where
 * `control/layout/diagrams/_shared/diagram.css` (served at
 * `/diagrams/_shared/diagram.css`) styles it.
 *
 * Fragment shape:
 *   <div class="mc-options-grid" data-group="..." data-category="..." data-question="...">
 *     <div class="mc-option-card [selected]" data-value="...">
 *        <!-- visual content (mini-mockup / arch-node / flow-step) -->
 *        <div class="mc-card-label">...</div>
 *        <div class="mc-card-desc">...</div>
 *     </div>
 *     ...
 *   </div>
 *
 * Pure function: no IO, no globals.
 */

/**
 * Escape HTML so option labels / questions can never break out of attributes
 * or inject markup.
 */
export function escapeHtml(value) {
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

function shortLabel(option, maxLen = 80) {
  const s = String(option == null ? '' : option);
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1).trimEnd() + '…';
}

/**
 * The "headline" portion of an option string — text before the first em-dash,
 * en-dash, or parenthesis. Used for the card label so the visual stays compact.
 * Plain hyphens are NOT treated as separators so words like "auto-detects"
 * stay intact.
 */
function deriveLabel(option) {
  const s = String(option == null ? '' : option);
  const match = s.match(/^([^—–(]+?)\s*(?:[—–(]|$)/);
  const head = match ? match[1].trim() : s.trim();
  return head || s.trim();
}

function deriveDesc(option) {
  const s = String(option == null ? '' : option);
  const label = deriveLabel(s);
  if (label === s.trim()) return '';
  // Strip the label + any leading separator punctuation.
  const rest = s.slice(label.length).replace(/^[\s–—\(]+/, '').trim();
  // Drop a trailing close-paren so "Foo (bar)" → desc "bar" not "bar)".
  return rest.replace(/\)\s*$/, '').trim();
}

// ---------------------------------------------------------------------------
// Per-category default visual generators
// ---------------------------------------------------------------------------

const UI_MOCKUP_VARIANTS = [
  // dialog
  `<div class="mc-mini-frame">
    <div class="mc-mini-bg">
      <div class="mc-mini-bg-line title"></div>
      <div class="mc-mini-bg-line lg"></div>
      <div class="mc-mini-bg-line md"></div>
      <div class="mc-mini-bg-line sm"></div>
    </div>
    <div class="mc-mini-scrim"></div>
    <div class="mc-mini-dialog">
      <div class="ln first"></div>
      <div class="ln"></div>
      <div class="ln"></div>
      <div class="actions">
        <div class="btn"></div>
        <div class="btn primary"></div>
      </div>
    </div>
  </div>`,
  // drawer
  `<div class="mc-mini-frame">
    <div class="mc-mini-bg">
      <div class="mc-mini-bg-line title"></div>
      <div class="mc-mini-bg-line lg"></div>
      <div class="mc-mini-bg-line md"></div>
      <div class="mc-mini-bg-line sm"></div>
    </div>
    <div class="mc-mini-drawer">
      <div class="item active"><div class="dot"></div><div class="ln"></div></div>
      <div class="item"><div class="dot"></div><div class="ln"></div></div>
      <div class="item"><div class="dot"></div><div class="ln"></div></div>
      <div class="item"><div class="dot"></div><div class="ln"></div></div>
      <div class="item"><div class="dot"></div><div class="ln"></div></div>
    </div>
  </div>`,
  // sheet
  `<div class="mc-mini-frame">
    <div class="mc-mini-bg">
      <div class="mc-mini-bg-line title"></div>
      <div class="mc-mini-bg-line lg"></div>
      <div class="mc-mini-bg-line md"></div>
    </div>
    <div class="mc-mini-sheet">
      <div class="handle"></div>
      <div class="item active"><div class="icon"></div><div class="ln"></div></div>
      <div class="item"><div class="icon"></div><div class="ln"></div></div>
      <div class="item"><div class="icon"></div><div class="ln"></div></div>
      <div class="item"><div class="icon"></div><div class="ln"></div></div>
    </div>
  </div>`,
];

const ARCH_NODE_VARIANTS = [
  `<div class="mc-diagram-surface">
    <div class="mc-arch-node accent">App</div>
    <div class="mc-arch-arrow"><div class="line"></div><span class="label">queries</span></div>
    <div class="mc-arch-node green">Database</div>
  </div>`,
  `<div class="mc-diagram-surface">
    <div class="mc-arch-node accent">Client</div>
    <div class="mc-arch-arrow"><div class="line"></div><span class="label">REST</span></div>
    <div class="mc-arch-node violet">Service</div>
    <div class="mc-arch-arrow"><div class="line"></div><span class="label">writes</span></div>
    <div class="mc-arch-node green">Store</div>
  </div>`,
  `<div class="mc-diagram-surface">
    <div class="mc-arch-node warn">Edge / CDN</div>
    <div class="mc-arch-arrow"><div class="line"></div><span class="label">invokes</span></div>
    <div class="mc-arch-node accent">Function</div>
    <div class="mc-arch-arrow"><div class="line"></div><span class="label">reads</span></div>
    <div class="mc-arch-node green">KV Store</div>
  </div>`,
  `<div class="mc-diagram-surface">
    <div class="mc-arch-node danger">Worker</div>
    <div class="mc-arch-arrow"><div class="line"></div><span class="label">enqueues</span></div>
    <div class="mc-arch-node violet">Queue</div>
    <div class="mc-arch-arrow"><div class="line"></div><span class="label">drives</span></div>
    <div class="mc-arch-node accent">Pipeline</div>
  </div>`,
];

const UX_FLOW_VARIANTS = [
  ['Start', 'Pick', 'Confirm'],
  ['Open', 'Configure', 'Submit', 'Done'],
  ['Trigger', 'Review', 'Approve'],
  ['Browse', 'Select', 'Detail', 'Apply'],
];

function defaultUiVisual(optionIndex) {
  return UI_MOCKUP_VARIANTS[optionIndex % UI_MOCKUP_VARIANTS.length];
}

function defaultEngineeringVisual(optionIndex) {
  return ARCH_NODE_VARIANTS[optionIndex % ARCH_NODE_VARIANTS.length];
}

function defaultUxVisual(optionIndex) {
  const steps = UX_FLOW_VARIANTS[optionIndex % UX_FLOW_VARIANTS.length];
  const stepEls = steps
    .map(
      (label, i) =>
        `      <div class="mc-flow-step${i === 0 ? ' active' : ''}">
        <span class="mc-flow-num">${i + 1}</span>
        <div class="mc-flow-circle">${i + 1}</div>
        <span class="mc-flow-label">${escapeHtml(label)}</span>
      </div>`,
    )
    .join('\n');
  return `<div class="mc-flow-timeline">
${stepEls}
    </div>`;
}

function defaultGenericVisual(optionIndex) {
  // Neutral placeholder — used when category is unknown.
  return `<div class="mc-diagram-surface">
    <div class="mc-arch-node accent">Option ${optionIndex + 1}</div>
  </div>`;
}

/**
 * Build an HTML fragment visualizing a decision.
 *
 * @param {object} decision - decision record (must have id, question,
 *   options, optional category, optional selected)
 * @param {object} [opts]
 * @param {Object<string, {type?: string, content?: string}>} [opts.optionVisuals]
 *   - per-option visual override map keyed by option string.
 *     When provided, `content` is inlined verbatim (already-escaped HTML).
 * @returns {string} HTML fragment (a single `<div class="mc-options-grid">`)
 */
export function buildVisualFragment(decision, opts = {}) {
  if (!decision || typeof decision !== 'object') {
    throw new Error('buildVisualFragment: decision is required');
  }
  const groupId = decision.id || '';
  const question = decision.question || '';
  const category = decision.category || 'unknown';
  const selected = decision.selected || '';
  const options = Array.isArray(decision.options) ? decision.options : [];
  const optionVisuals = (opts && opts.optionVisuals) || {};

  function visualFor(option, idx) {
    const override = optionVisuals[option];
    if (override && typeof override.content === 'string') {
      return override.content;
    }
    switch (category) {
      case 'ui':
        return defaultUiVisual(idx);
      case 'engineering':
        return defaultEngineeringVisual(idx);
      case 'ux':
        return defaultUxVisual(idx);
      default:
        return defaultGenericVisual(idx);
    }
  }

  const cards = options
    .map((option, idx) => {
      const isSelected = option === selected;
      const visual = visualFor(option, idx);
      const labelText = deriveLabel(option);
      const descText = deriveDesc(option);
      const labelHtml = escapeHtml(shortLabel(labelText, 80));
      const descHtml = descText ? escapeHtml(shortLabel(descText, 140)) : '';
      const descBlock = descHtml
        ? `\n      <div class="mc-card-desc">${descHtml}</div>`
        : '';
      return `    <div class="mc-option-card${isSelected ? ' selected' : ''}" data-value="${escapeHtml(option)}" tabindex="0" role="radio" aria-checked="${isSelected ? 'true' : 'false'}">
      <span class="mc-checkmark" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M3 7.5L5.5 10L11 4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      ${visual}
      <div class="mc-card-label">${labelHtml}</div>${descBlock}
    </div>`;
    })
    .join('\n');

  return `<div class="mc-options-grid" data-group="${escapeHtml(groupId)}" data-category="${escapeHtml(category)}" data-question="${escapeHtml(question)}">
${cards}
  </div>`;
}

// Exported for tests
export const __test__ = {
  deriveLabel,
  deriveDesc,
  defaultUiVisual,
  defaultEngineeringVisual,
  defaultUxVisual,
  defaultGenericVisual,
};
