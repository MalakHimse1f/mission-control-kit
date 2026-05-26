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
      <a class="live-item" href="/feature/${slugPath}" data-feature="${escapeAttr(slug)}">
        <div class="live-item-header">
          <span class="pulse-dot"></span>
          <span class="live-item-name">${slugEsc}</span>
          <span class="phase-badge">${escapeHtml(phase)}</span>
        </div>${progressRow}
      </a>`;
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
      <a class="next-item" href="/feature/${slugPath}" data-feature="${escapeAttr(slug)}">
        <div class="next-item-header">
          <span class="next-item-name">${slugEsc}</span>
        </div>
        ${description}
        <div class="next-item-footer">
          <span class="stage-badge">${escapeHtml(stageLabel)}</span>
          <span class="open-arrow">→</span>
        </div>
      </a>
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

/**
 * Slash-command reference, organised by phase. Edits land here when commands
 * are added or removed from /Users/lane/Documents/mission-control-kit/commands/.
 * Keep entries short — the dashboard "How to use" panel is a reference, not
 * full docs.
 */
const SLASH_COMMAND_GROUPS = [
  {
    label: 'Project START',
    items: [
      { cmd: '/mc-start', desc: 'Start a new project (tech stack + first feature)' },
      { cmd: '/mc-init', desc: 'Establish tech-stack context before any feature work' },
    ],
  },
  {
    label: 'v5 Feature flow',
    items: [
      { cmd: '/mc-v5', desc: 'v5 orchestrator hub — entry point for new features' },
      { cmd: '/mc-v5-resume <slug>', desc: 'Resume an in-flight v5 feature from disk' },
    ],
  },
  {
    label: 'v4 Feature flow (still supported)',
    items: [
      { cmd: '/mc-feature', desc: 'Add a new feature (braindump → explore → spec → build)' },
      { cmd: '/mc-refine', desc: 'Resume an interrupted braindump' },
      { cmd: '/mc-layout', desc: 'Wireframe + layout step' },
      { cmd: '/mc-plan', desc: 'Generate phased implementation plan' },
      { cmd: '/mc-portfolio', desc: 'Holistic review of all approved specs' },
      { cmd: '/mc-build', desc: 'Dispatch the build subagent from HANDOFF' },
      { cmd: '/mc-validate', desc: 'Orchestrator-internal validation gate' },
    ],
  },
  {
    label: 'Session + maintenance',
    items: [
      { cmd: '/mc-handoff', desc: 'Structured end-of-chat session handoff' },
      { cmd: '/mc-upgrade', desc: 'Safe kit upgrade to the latest release' },
      { cmd: '/mc', desc: 'Mission Control router — picks the right workflow' },
    ],
  },
];

/**
 * Bundled skill packages MCK auto-invokes. Keep these in lock-step with
 * /Users/lane/Documents/mission-control-kit/control/vendor/manifest.json.
 */
const BUNDLED_SKILLS = [
  {
    id: 'mck-builtin',
    tag: 'MCK',
    tagClass: 'tag-mck',
    name: 'Mission Control Kit (built-in)',
    skills: [
      { name: 'mc-v5', desc: 'Orchestrator hub' },
      { name: 'mc-v5-brainstorm', desc: 'Brainstorm flow + research dispatch' },
      { name: 'mc-v5-decide', desc: 'Decision encoding + visual fragment generation' },
      { name: 'mc-v5-build', desc: 'Build subagent (MVVM-enforced)' },
      { name: 'mc-v5-review', desc: 'Auto-launch dashboard at decision points' },
    ],
    attribution: 'Mission Control Kit — this repository',
    href: 'https://github.com/MalakHimse1f/mission-control-kit',
  },
  {
    id: 'superpowers',
    tag: 'superpowers',
    tagClass: 'tag-superpowers',
    name: 'superpowers',
    skills: [
      { name: 'brainstorming', desc: 'Question-driven ideation' },
      { name: 'parallel-web-search', desc: 'Research dispatch (used by mc-v5-brainstorm)' },
      { name: 'writing-plans', desc: 'Plan authoring' },
      { name: 'subagent-driven-development', desc: 'Task dispatch loop' },
      { name: 'verification-before-completion', desc: 'Output verification' },
    ],
    attribution: 'Jesse Vincent (obra) · MIT',
    href: 'https://github.com/obra/superpowers',
  },
  {
    id: 'prd-generator',
    tag: 'prd-generator',
    tagClass: 'tag-prd',
    name: 'prd-generator',
    skills: [
      { name: 'prd-generator', desc: 'Generates spec.md from approved decisions' },
    ],
    attribution: 'James Rochabrun (jamesrochabrun)',
    href: 'https://github.com/jamesrochabrun/skills',
  },
  {
    id: 'designer-skills',
    tag: 'designer-skills',
    tagClass: 'tag-designer',
    name: 'designer-skills',
    skills: [
      { name: 'design-research', desc: 'Pattern research for UI decisions' },
      { name: 'ux-strategy', desc: 'UX flow rationale' },
      { name: 'interaction-design', desc: 'Affordance + interaction modeling' },
      { name: 'visual-critique', desc: 'Layout and hierarchy review' },
    ],
    attribution: 'Owl-Listener',
    href: 'https://github.com/Owl-Listener/designer-skills',
  },
  {
    id: 'startup-skill',
    tag: 'startup-skill',
    tagClass: 'tag-startup',
    name: 'startup-skill',
    skills: [
      { name: 'startup-design', desc: 'Brand and identity at project-start' },
      { name: 'startup-competitors', desc: 'Competitive analysis' },
      { name: 'startup-positioning', desc: 'Market positioning' },
      { name: 'startup-pitch', desc: 'Pitch deck drafting' },
    ],
    attribution: 'Ferdinando Bons (ferdinandobons)',
    href: 'https://github.com/ferdinandobons/startup-skill',
  },
];

const TYPICAL_WORKFLOWS = [
  {
    label: 'Brand new project',
    sequence: ['/mc-start', '/mc-init', '/mc-v5 (per feature)'],
  },
  {
    label: 'Add a feature (v5)',
    sequence: ['/mc-v5', 'brainstorm → decisions saved', '/mc-v5-resume <slug>', '/mc-build'],
  },
  {
    label: 'Add a feature (v4, still works)',
    sequence: ['/mc-feature', '/mc-layout', '/mc-plan', '/mc-build', '/mc-validate'],
  },
  {
    label: 'End of session',
    sequence: ['/mc-handoff', '/clear', '(new session) /mc-v5-resume <slug>'],
  },
];

function renderHowToUse() {
  const commandGroups = SLASH_COMMAND_GROUPS.map(
    (g) => `
            <div class="cmd-group">
              <h4>${escapeHtml(g.label)}</h4>
              <ul>${g.items
                .map(
                  (it) => `
                <li><code>${escapeHtml(it.cmd)}</code><span class="cmd-desc">${escapeHtml(it.desc)}</span></li>`,
                )
                .join('')}
              </ul>
            </div>`,
  ).join('');

  const bundleCards = BUNDLED_SKILLS.map(
    (b) => `
            <div class="bundle-card">
              <div class="bundle-card-header">
                <span class="skill-tag ${escapeAttr(b.tagClass)}">${escapeHtml(b.tag)}</span>
                <span class="bundle-card-title">${escapeHtml(b.name)}</span>
              </div>
              <ul>${b.skills
                .map(
                  (s) => `
                <li><code>${escapeHtml(s.name)}</code><span class="li-desc">${escapeHtml(s.desc)}</span></li>`,
                )
                .join('')}
              </ul>
              <div class="bundle-attribution">— <a href="${escapeAttr(b.href)}" target="_blank" rel="noopener">${escapeHtml(b.attribution)}</a></div>
            </div>`,
  ).join('');

  const workflowItems = TYPICAL_WORKFLOWS.map(
    (w) => `
            <li><strong>${escapeHtml(w.label)}</strong>: ${w.sequence
              .map((step) => `<code>${escapeHtml(step)}</code>`)
              .join(' <span class="wf-arrow">→</span> ')}</li>`,
  ).join('');

  return `
    <details class="how-to-use">
      <summary>
        <span class="how-to-toggle">▸</span>
        <span class="how-to-title">How to use Mission Control Kit</span>
        <span class="how-to-hint">Click to expand — slash commands, bundled skills, common workflows</span>
      </summary>
      <div class="how-to-body">

        <section class="how-section">
          <h3>Slash commands</h3>
          <div class="cmd-grid">${commandGroups}
          </div>
        </section>

        <section class="how-section">
          <h3>Bundled skills</h3>
          <p class="how-section-desc">
            MCK auto-invokes these skill bundles during brainstorming, decision encoding, and build phases.
            They are referenced in routing docs at <code>control/v5/routing/</code> and pulled at install time —
            none are bundled as code inside this repo.
          </p>
          <div class="bundle-grid">${bundleCards}
          </div>
        </section>

        <section class="how-section">
          <h3>Typical workflows</h3>
          <ol class="workflow-list">${workflowItems}
          </ol>
        </section>

      </div>
    </details>`;
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
${renderHowToUse()}
  </div>
  <script src="/dashboard-client.js" defer></script>
</body>
</html>
`;
}

// Exported for tests
export const __test__ = { escapeHtml, relativeTime };
