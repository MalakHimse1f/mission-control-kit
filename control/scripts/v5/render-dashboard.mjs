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

import { buildPickupPrompt } from '../../../lib/v5/build-pickup-prompt.mjs';

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

/**
 * Pick the feature the user is most likely picking up where they left off.
 * Priority:
 *   1. state.activeFeature if it resolves to a real feature
 *   2. most recently updated in-progress feature
 *   3. most recently updated needs-input feature
 *   4. otherwise null (the panel is hidden)
 */
function pickActiveFeature(data) {
  const all = Array.isArray(data.allItems) ? data.allItems : [];
  const byActiveSlug = data.state && data.state.activeFeature
    ? all.find((f) => f.slug === data.state.activeFeature)
    : null;
  if (byActiveSlug) return byActiveSlug;
  const live = Array.isArray(data.liveAgents) ? data.liveAgents : [];
  if (live.length > 0) return live[0];
  const needsInput = all.filter((f) => f.stage === 'needs-input');
  if (needsInput.length > 0) return needsInput[0];
  return null;
}

/**
 * Render the "Pickup where you left off" panel. Shows the canonical
 * 2-sentence prompt + a copy button. The user pastes it into a fresh chat
 * to resume work without relying on chat compaction.
 */
function renderPickupPanel(data) {
  const feature = pickActiveFeature(data);
  if (!feature) {
    return `
    <div class="section-label">Pickup where you left off</div>
    <div class="panel">
      <div class="muted-text empty-state">Nothing active yet — start a feature with <code>/mc-v5</code>.</div>
    </div>`;
  }
  const slug = feature.slug;
  const slugEsc = escapeHtml(slug);
  const slugPath = encodePathSegment(slug);
  // currentPhase is the precise stage v5 cares about (ux / ui / architecture /
  // build / mock). Fall back to the bucket stage if no currentPhase recorded.
  const stage = feature.currentPhase || feature.stage || 'unknown';
  const prompt = buildPickupPrompt({ slug, stage });
  const stageLabel = STAGE_LABEL[feature.stage] || feature.stage || '';
  const phaseLabel = feature.currentPhase ? capitalize(feature.currentPhase) : '';

  return `
    <div class="section-label">Pickup where you left off</div>
    <div class="panel panel-pickup">
      <div class="pickup-header">
        <a class="pickup-feature" href="/feature/${slugPath}">
          <span class="pickup-name">${slugEsc}</span>${phaseLabel ? `<span class="phase-badge">${escapeHtml(phaseLabel)}</span>` : ''}${stageLabel ? `<span class="stage-badge">${escapeHtml(stageLabel)}</span>` : ''}
        </a>
      </div>
      <div class="pickup-prompt-row">
        <pre class="pickup-prompt" id="pickup-prompt-text">${escapeHtml(prompt)}</pre>
        <button class="pickup-copy" type="button" data-copy-target="pickup-prompt-text">
          <span class="copy-icon" aria-hidden="true">⧉</span>
          <span class="copy-label">Copy pickup prompt</span>
        </button>
      </div>
      <p class="pickup-hint">
        Paste into a fresh chat to resume without leaning on compaction.
        The orchestrator reads the rest of its context on demand via the v5 router.
      </p>
    </div>`;
}

/**
 * A compact "Copy pickup" button for a single feature. Generates the
 * canonical 2-sentence prompt and stashes it on the button via `data-copy`
 * so the global copy handler picks it up. Returns '' if the feature is
 * complete (nothing to resume).
 */
function renderRowPickupButton(feature) {
  if (!feature || feature.stage === 'complete') return '';
  const stage = feature.currentPhase || feature.stage || 'unknown';
  const prompt = buildPickupPrompt({ slug: feature.slug, stage });
  return `<button class="row-pickup" type="button" data-copy="${escapeAttr(prompt)}" title="Copy pickup prompt — paste in a fresh chat to resume" onclick="event.preventDefault(); event.stopPropagation();"><span class="copy-icon" aria-hidden="true">⧉</span><span class="row-pickup-label">Pickup</span></button>`;
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
          ${renderRowPickupButton(feature)}
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
          ${renderRowPickupButton(upNext)}
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
          ${renderRowPickupButton(feature)}
        </a>`;
}

/**
 * Slash-command reference, organised by phase. Edits land here when commands
 * are added or removed from /Users/lane/Documents/mission-control-kit/commands/.
 * Keep entries short — the dashboard "How to use" panel is a reference, not
 * full docs.
 */
/**
 * Flat list of every slash command available in the kit, with one-line "how
 * to use it" copy. Each row gets a copy-to-clipboard button in the UI.
 */
const SLASH_COMMANDS = [
  { cmd: '/mc', desc: 'Mission Control router — picks the right workflow for your input.' },
  { cmd: '/mc-start', desc: 'Start a new project. Establishes the tech stack and seeds the first feature.' },
  { cmd: '/mc-init', desc: 'Establish tech-stack context. Run before any feature work in a new project.' },
  { cmd: '/mc-v5', desc: 'v5 orchestrator hub. Entry point for new features in the v5 pipeline.' },
  { cmd: '/mc-v5-resume <slug>', desc: 'Resume a v5 feature where you left off. Reads status.json + decisions.json from disk.' },
  { cmd: '/mc-feature', desc: 'Add a new feature. Drives braindump → explore → spec → build for one feature.' },
  { cmd: '/mc-refine', desc: 'Resume an interrupted braindump. Picks up after a /clear or session crash.' },
  { cmd: '/mc-layout', desc: 'Wireframe + layout step. Produces HTML mocks for screens in the active feature.' },
  { cmd: '/mc-plan', desc: 'Generate a phased implementation plan from the approved spec.' },
  { cmd: '/mc-portfolio', desc: 'Holistic review across all approved specs. Surfaces overlap, contradictions, build order.' },
  { cmd: '/mc-build', desc: 'Dispatch the build subagent from the active HANDOFF doc.' },
  { cmd: '/mc-validate', desc: 'Orchestrator-internal validation gate. Used between phases of the pipeline.' },
  { cmd: '/mc-handoff', desc: 'Structured end-of-chat session handoff. Run before /clear so the next session can pick up.' },
  { cmd: '/mc-upgrade', desc: 'Safe kit upgrade to the latest release. Runs migrations, preserves your data.' },
];

/**
 * Bundled skill packages MCK auto-invokes. Keep these in lock-step with
 * /Users/lane/Documents/mission-control-kit/control/vendor/manifest.json.
 */
/**
 * Flat list of every bundled skill the kit auto-invokes, with its source +
 * one-line "how to use it" copy. Sources kept in lock-step with
 * `control/vendor/manifest.json`. Each row gets a copy-to-clipboard button on
 * the skill name in the UI.
 */
const BUNDLED_SKILLS = [
  // Mission Control Kit — built into this repo
  { name: 'mc-v5', source: 'MCK', sourceClass: 'tag-mck', sourceHref: 'https://github.com/MalakHimse1f/mission-control-kit', desc: 'Orchestrator hub. Routes a fresh user message into the right v5 workflow.' },
  { name: 'mc-v5-brainstorm', source: 'MCK', sourceClass: 'tag-mck', sourceHref: 'https://github.com/MalakHimse1f/mission-control-kit', desc: 'Brainstorm flow. Always offers research, transforms patterns into a UX flow diagram, opens the dashboard.' },
  { name: 'mc-v5-decide', source: 'MCK', sourceClass: 'tag-mck', sourceHref: 'https://github.com/MalakHimse1f/mission-control-kit', desc: 'Encodes a single decision. Writes decisions.json + generates the visual fragment via build-decision.mjs.' },
  { name: 'mc-v5-build', source: 'MCK', sourceClass: 'tag-mck', sourceHref: 'https://github.com/MalakHimse1f/mission-control-kit', desc: 'Build subagent. Enforces MVVM layering and checks every decision has a visual fragment.' },
  { name: 'mc-v5-review', source: 'MCK', sourceClass: 'tag-mck', sourceHref: 'https://github.com/MalakHimse1f/mission-control-kit', desc: 'Auto-launches the dashboard at decision points so you can review without leaving the loop.' },

  // superpowers — Jesse Vincent (obra)
  { name: 'brainstorming', source: 'superpowers', sourceClass: 'tag-superpowers', sourceHref: 'https://github.com/obra/superpowers', desc: 'Question-driven ideation. Drives the conversational arc inside mc-v5-brainstorm.' },
  { name: 'parallel-web-search', source: 'superpowers', sourceClass: 'tag-superpowers', sourceHref: 'https://github.com/obra/superpowers', desc: 'Dispatched by mc-v5-brainstorm whenever the user says "yes" to research.' },
  { name: 'parallel-deep-research', source: 'superpowers', sourceClass: 'tag-superpowers', sourceHref: 'https://github.com/obra/superpowers', desc: 'Deeper alternative to parallel-web-search. Used when the user asks for "deep" research.' },
  { name: 'writing-plans', source: 'superpowers', sourceClass: 'tag-superpowers', sourceHref: 'https://github.com/obra/superpowers', desc: 'Plan authoring. Turns a spec into a phased implementation plan.' },
  { name: 'subagent-driven-development', source: 'superpowers', sourceClass: 'tag-superpowers', sourceHref: 'https://github.com/obra/superpowers', desc: 'Task dispatch loop. The orchestrator uses this to drive parallel build subagents.' },
  { name: 'verification-before-completion', source: 'superpowers', sourceClass: 'tag-superpowers', sourceHref: 'https://github.com/obra/superpowers', desc: 'Output verification. Each subagent self-checks before reporting DONE.' },

  // prd-generator — James Rochabrun
  { name: 'prd-generator', source: 'prd-generator', sourceClass: 'tag-prd', sourceHref: 'https://github.com/jamesrochabrun/skills', desc: 'Generates spec.md from approved decisions. Auto-invoked at the end of brainstorming.' },

  // designer-skills — Owl-Listener
  { name: 'design-research', source: 'designer-skills', sourceClass: 'tag-designer', sourceHref: 'https://github.com/Owl-Listener/designer-skills', desc: 'Pattern research for UI decisions. Feeds into UI-tab diagrams.' },
  { name: 'ux-strategy', source: 'designer-skills', sourceClass: 'tag-designer', sourceHref: 'https://github.com/Owl-Listener/designer-skills', desc: 'UX flow rationale. Used by mc-v5-brainstorm to ground UX decisions.' },
  { name: 'interaction-design', source: 'designer-skills', sourceClass: 'tag-designer', sourceHref: 'https://github.com/Owl-Listener/designer-skills', desc: 'Affordance + interaction modeling. Used when building diagrams in the UX phase.' },
  { name: 'visual-critique', source: 'designer-skills', sourceClass: 'tag-designer', sourceHref: 'https://github.com/Owl-Listener/designer-skills', desc: 'Layout and hierarchy review. Auto-invoked during UI decisions.' },

  // startup-skill — Ferdinando Bons
  { name: 'startup-design', source: 'startup-skill', sourceClass: 'tag-startup', sourceHref: 'https://github.com/ferdinandobons/startup-skill', desc: 'Brand and identity at project-start. Auto-invoked by /mc-start.' },
  { name: 'startup-competitors', source: 'startup-skill', sourceClass: 'tag-startup', sourceHref: 'https://github.com/ferdinandobons/startup-skill', desc: 'Competitive analysis. Part of the project-start workflow.' },
  { name: 'startup-positioning', source: 'startup-skill', sourceClass: 'tag-startup', sourceHref: 'https://github.com/ferdinandobons/startup-skill', desc: 'Market positioning. Drafts your "why this, why now" narrative.' },
  { name: 'startup-pitch', source: 'startup-skill', sourceClass: 'tag-startup', sourceHref: 'https://github.com/ferdinandobons/startup-skill', desc: 'Pitch deck drafting. Final step of the project-start workflow.' },
];

const TYPICAL_WORKFLOWS = [
  {
    label: 'Brand new project',
    sequence: ['/mc-start', '/mc-init', '/mc-v5 (per feature)'],
  },
  {
    label: 'Add a feature',
    sequence: ['/mc-v5', 'brainstorm → decisions saved', '/mc-v5-resume <slug>', '/mc-build'],
  },
  {
    label: 'Quick feature (no brainstorm)',
    sequence: ['/mc-feature', '/mc-layout', '/mc-plan', '/mc-build', '/mc-validate'],
  },
  {
    label: 'End of session',
    sequence: ['/mc-handoff', '/clear', '(new session) /mc-v5-resume <slug>'],
  },
];

/**
 * One row in the slash-commands or bundled-skills table. Column 1 is the
 * copy chip (clicking copies the literal name); column 2 is "how to use it".
 * The `extra` column (only for the skills table) shows the source attribution.
 */
function renderCopyRow({ name, desc, source, sourceClass, sourceHref }) {
  const sourceCell =
    source != null
      ? `
              <td class="col-source">
                <a class="skill-tag ${escapeAttr(sourceClass || '')}" href="${escapeAttr(sourceHref || '#')}" target="_blank" rel="noopener">${escapeHtml(source)}</a>
              </td>`
      : '';
  return `
            <tr>
              <td class="col-name">
                <button class="copy-btn" type="button" data-copy="${escapeAttr(name)}" title="Copy to clipboard">
                  <code>${escapeHtml(name)}</code>
                  <span class="copy-icon" aria-hidden="true">⧉</span>
                </button>
              </td>${sourceCell}
              <td class="col-desc">${escapeHtml(desc)}</td>
            </tr>`;
}

function renderHowToUse() {
  const commandRows = SLASH_COMMANDS.map((it) =>
    renderCopyRow({ name: it.cmd, desc: it.desc }),
  ).join('');

  const skillRows = BUNDLED_SKILLS.map((s) =>
    renderCopyRow({
      name: s.name,
      desc: s.desc,
      source: s.source,
      sourceClass: s.sourceClass,
      sourceHref: s.sourceHref,
    }),
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
          <table class="howto-table">
            <thead>
              <tr><th class="col-name">Command</th><th class="col-desc">How to use it</th></tr>
            </thead>
            <tbody>${commandRows}
            </tbody>
          </table>
        </section>

        <section class="how-section">
          <h3>Bundled skills</h3>
          <p class="how-section-desc">
            MCK auto-invokes these skills during brainstorming, decision encoding, and build phases.
            They are referenced in routing docs at <code>control/v5/routing/</code> and pulled at install time —
            none are bundled as code inside this repo.
          </p>
          <table class="howto-table howto-table-skills">
            <thead>
              <tr><th class="col-name">Skill</th><th class="col-source">Source</th><th class="col-desc">How to use it</th></tr>
            </thead>
            <tbody>${skillRows}
            </tbody>
          </table>
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
/**
 * Render the kit-version banner. Empty string when the install is
 * up-to-date or the check hasn't run yet — the dashboard-client.js
 * polls `/api/kit-version` and replaces this strip after page load,
 * so a non-empty SSR value just primes the first render.
 */
function renderKitVersionStrip(kitVersion) {
  if (!kitVersion || !kitVersion.updateAvailable) {
    // Empty mount-point — client JS will populate it if the polled check
    // surfaces an update or an error after the page renders.
    return '<div class="kit-version-strip" id="kit-version-strip" hidden></div>';
  }
  const local = escapeHtml(kitVersion.local || '');
  const remote = escapeHtml(kitVersion.remote || '');
  const repo = escapeHtml(kitVersion.repo || '');
  const ref = escapeHtml(kitVersion.ref || '');
  const migs = (kitVersion.newMigrations || [])
    .map((m) => `<code class="kit-migration-pill">${escapeHtml(m)}</code>`)
    .join(' ');
  const migLine = migs ? `<div class="kit-migration-line">new migrations: ${migs}</div>` : '';
  return `<div class="kit-version-strip update-available" id="kit-version-strip">
    <div class="kit-version-body">
      <strong class="kit-version-headline">Mission Control Kit update available</strong>
      — you're on <code class="kit-version-pill">${local}</code>,
      latest is <code class="kit-version-pill">${remote}</code>
      on <a href="https://github.com/${repo}/releases" target="_blank" rel="noopener">${repo}@${ref}</a>.
      ${migLine}
      <div class="kit-upgrade-msg" id="kit-upgrade-msg"></div>
    </div>
    <button type="button" id="kit-upgrade-btn" class="kit-upgrade-btn">Upgrade kit</button>
  </div>`;
}

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
  const kitVersion = safeData.kitVersion || null;
  const now = typeof opts.now === 'number' ? opts.now : Date.now();
  const title = opts.title || 'Mission Control Kit v5 — Dashboard';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/dashboard.css" />
  <!-- API: /api/v5/features (JSON) · /api/kit-version · /api/kit-upgrade -->
</head>
<body>
${renderKitVersionStrip(kitVersion)}
  <div class="container">
    <h1>Mission Control Kit</h1>
    <p class="subtitle">v5 Dashboard — Feature pipeline at a glance</p>
${renderPickupPanel(safeData)}
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
