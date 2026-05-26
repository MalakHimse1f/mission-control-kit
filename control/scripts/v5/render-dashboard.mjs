/**
 * v5 dashboard HTML renderer.
 *
 * Pure function: takes the bucketed data from lib/v5/dashboard-data.mjs and
 * returns a complete HTML document as a string. No file IO, no globals.
 *
 * Visual reference: docs/v5-diagrams/06-dashboard-mockup.html.
 * CSS lives in control/scripts/v5/dashboard.css (served at /dashboard.css).
 * Client JS lives in control/scripts/v5/dashboard-client.js (served at
 * /dashboard-client.js).
 */

const STAGE_DOT = {
  'needs-input': 'dot-input',
  ready: 'dot-ready',
  'in-progress': 'dot-progress',
  complete: 'dot-complete',
};

const STAGE_LABEL = {
  'needs-input': 'Needs input',
  ready: 'Ready',
  'in-progress': 'In progress',
  complete: 'Complete',
};

const STAGE_CATEGORY = {
  'needs-input': 'needs-input',
  ready: 'ready',
  'in-progress': 'in-progress',
  complete: 'complete',
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

function encodePathSegment(value) {
  // Encode a slug for use in a URL path. encodeURIComponent already escapes
  // everything that's unsafe; we additionally HTML-escape the result for the
  // attribute context.
  return escapeAttr(encodeURIComponent(String(value == null ? '' : value)));
}

/** Format an ISO timestamp as "Updated N {unit} ago" or "" if invalid. */
function relativeTime(iso, now = Date.now()) {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  let delta = Math.max(0, Math.round((now - t) / 1000));
  const units = [
    { label: 'y', secs: 365 * 24 * 3600 },
    { label: 'mo', secs: 30 * 24 * 3600 },
    { label: 'w', secs: 7 * 24 * 3600 },
    { label: 'd', secs: 24 * 3600 },
    { label: 'h', secs: 3600 },
    { label: 'm', secs: 60 },
  ];
  for (const u of units) {
    const n = Math.floor(delta / u.secs);
    if (n >= 1) return `Updated ${n}${u.label} ago`;
  }
  return 'Updated just now';
}

function renderLiveAgent(feature) {
  const slug = feature.slug;
  const slugEsc = escapeHtml(slug);
  const slugPath = encodePathSegment(slug);
  const phase = feature.currentPhase
    ? `${capitalize(feature.currentPhase)}`
    : 'In progress';
  const progress = feature.progress;
  const progressRow = progress
    ? `
        <div class="progress-row">
          <span class="progress-text">Task ${progress.done}/${progress.total}</span>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress.percent}%;"></div>
          </div>
        </div>`
    : '';
  return `
      <div class="live-item" data-feature="${escapeAttr(slug)}">
        <div class="live-item-header">
          <span class="pulse-dot"></span>
          <span class="live-item-name"><a href="/feature/${slugPath}">${slugEsc}</a></span>
          <span class="phase-badge">${escapeHtml(phase)}</span>
        </div>${progressRow}
      </div>`;
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function renderLiveAgentsPanel(liveAgents) {
  if (!liveAgents || liveAgents.length === 0) {
    return `
    <div class="section-label">Live Agents</div>
    <div class="panel">
      <div class="muted-text empty-state">No agents currently working</div>
    </div>`;
  }
  const items = liveAgents.map(renderLiveAgent).join('\n');
  return `
    <div class="section-label">Live Agents</div>
    <div class="panel panel-live">${items}
    </div>`;
}

function renderUpNextPanel(upNext) {
  if (!upNext) {
    return `
    <div class="section-label">Up Next</div>
    <div class="panel">
      <div class="muted-text empty-state">Queue is clear</div>
    </div>`;
  }
  const slug = upNext.slug;
  const slugEsc = escapeHtml(slug);
  const slugPath = encodePathSegment(slug);
  const description = upNext.description
    ? `<div class="next-item-desc">${escapeHtml(upNext.description)}</div>`
    : '';
  const stageLabel = STAGE_LABEL[upNext.stage] || 'Ready';
  return `
    <div class="section-label">Up Next</div>
    <div class="panel">
      <div class="next-item" data-feature="${escapeAttr(slug)}">
        <div class="next-item-header">
          <span class="next-item-name"><a href="/feature/${slugPath}">${slugEsc}</a></span>
        </div>
        ${description}
        <div class="next-item-footer">
          <span class="stage-badge">${escapeHtml(stageLabel)}</span>
          <a class="open-link" href="/feature/${slugPath}">Open →</a>
        </div>
      </div>
    </div>`;
}

function renderItemRow(feature, now) {
  const slug = feature.slug;
  const slugEsc = escapeHtml(slug);
  const slugPath = encodePathSegment(slug);
  const dotClass = STAGE_DOT[feature.stage] || 'dot-input';
  const category = STAGE_CATEGORY[feature.stage] || 'needs-input';
  const stageLabel = STAGE_LABEL[feature.stage] || 'Needs input';
  const updated = relativeTime(feature.lastUpdatedAt, now);
  const updatedEl = updated ? `<span class="item-updated">${escapeHtml(updated)}</span>` : '';
  return `
        <a class="item-row" href="/feature/${slugPath}" data-category="${escapeAttr(category)}" data-feature="${escapeAttr(slug)}">
          <span class="item-dot ${dotClass}"></span>
          <span class="item-name">${slugEsc}</span>
          <span class="item-stage">${escapeHtml(stageLabel)}</span>
          ${updatedEl}
        </a>`;
}

function renderAllItemsPanel(allItems, filterCounts, now) {
  const counts = filterCounts || {
    needsInput: 0,
    ready: 0,
    inProgress: 0,
    complete: 0,
  };
  const pills = [
    { filter: 'needs-input', label: 'Needs Your Input', count: counts.needsInput },
    { filter: 'ready', label: 'Ready', count: counts.ready },
    { filter: 'in-progress', label: 'In Progress', count: counts.inProgress },
    { filter: 'complete', label: 'Complete', count: counts.complete },
  ]
    .map(
      (p) => `
        <button class="filter-pill" type="button" data-filter="${escapeAttr(p.filter)}" aria-pressed="false">${escapeHtml(p.label)}<span class="filter-count">(${p.count})</span></button>`,
    )
    .join('');

  const items =
    allItems && allItems.length > 0
      ? allItems.map((f) => renderItemRow(f, now)).join('\n')
      : `
        <div class="muted-text items-empty">No features yet — run <code>/mc-init</code> to get started.</div>`;

  return `
    <div class="section-label">All Items</div>
    <div class="panel">
      <div class="filter-bar">${pills}
      </div>
      <div class="items-list">${items}
      </div>
    </div>`;
}

/**
 * Render the full dashboard HTML document.
 *
 * @param {{
 *   liveAgents: Array,
 *   upNext: object|null,
 *   allItems: Array,
 *   filterCounts: { needsInput: number, ready: number, inProgress: number, complete: number },
 * }} data
 * @param {{ now?: number, title?: string }} [opts]
 * @returns {string}
 */
export function renderDashboard(data, opts = {}) {
  const safeData = data || {};
  const liveAgents = Array.isArray(safeData.liveAgents) ? safeData.liveAgents : [];
  const upNext = safeData.upNext || null;
  const allItems = Array.isArray(safeData.allItems) ? safeData.allItems : [];
  const filterCounts = safeData.filterCounts || {
    needsInput: 0,
    ready: 0,
    inProgress: 0,
    complete: 0,
  };
  const now = typeof opts.now === 'number' ? opts.now : Date.now();
  const title = opts.title || 'Mission Control Kit v5 — Dashboard';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/dashboard.css" />
  <!-- API: /api/v5/features (JSON) -->
</head>
<body>
  <div class="container">
    <h1>Mission Control Kit</h1>
    <p class="subtitle">v5 Dashboard — Feature pipeline at a glance</p>
${renderLiveAgentsPanel(liveAgents)}
${renderUpNextPanel(upNext)}
${renderAllItemsPanel(allItems, filterCounts, now)}
  </div>
  <script src="/dashboard-client.js" defer></script>
</body>
</html>
`;
}

// Exported for tests
export const __test__ = { escapeHtml, relativeTime };
