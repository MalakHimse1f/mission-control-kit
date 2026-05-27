/**
 * v5 diagram primitives — typed atom builders for per-decision visuals.
 *
 * Every decision option can specify ONE of three sources for its visual:
 *
 *   1. `preset`  → named preset from the catalog below
 *   2. `diagram` → structured atoms (per-category shape, rendered here)
 *   3. `raw`     → raw HTML escape hatch
 *
 * If a `decisions/{id}.visual.json` sidecar is missing or doesn't cover an
 * option, the decision-visual-builder rotates through legacy variants by
 * index — so existing decisions keep working without a sidecar.
 *
 * Schema for the structured `diagram` field, dispatched by the decision's
 * `category`:
 *
 *   UX (`category: "ux"`)
 *     {
 *       kind: "flow",
 *       steps: [
 *         { label: string, kind?: "start"|"step"|"decision"|"end", icon?: string }
 *       ],
 *       swimlane?: "user" | "system"
 *     }
 *
 *   UI (`category: "ui"`)
 *     {
 *       frame: "phone" | "desktop" | "modal" | "card",
 *       header?: { title?: string, back?: boolean, actions?: string[] },
 *       body: BodyElement[],
 *       footer?: { kind: "tab-bar" | "action-bar", items?: string[] }
 *     }
 *     BodyElement is one of:
 *       { kind: "list",    items: [{ icon?, title, subtitle? }, ...] }
 *       { kind: "grid",    items: [{ icon?, label }, ...], cols?: 2|3 }
 *       { kind: "form",    fields: [{ kind: "text"|"select"|"toggle", label }, ...] }
 *       { kind: "hero",    title, subtitle?, icon? }
 *       { kind: "text",    lines: number }
 *       { kind: "buttons", items: [{ label, primary? }, ...] }
 *       { kind: "empty",   label? }
 *
 *   Architecture (`category: "engineering"` or `category: "architecture"`)
 *     {
 *       nodes: [
 *         { id: string,
 *           kind: "client" | "service" | "db" | "queue" | "cache"
 *               | "edge" | "worker" | "external" | "actor" | "function",
 *           label: string }
 *       ],
 *       edges: [
 *         { from: nodeId, to: nodeId,
 *           kind?: "sync" | "async" | "data" | "dep",
 *           label?: string }
 *       ]
 *     }
 *
 * Pure functions: no IO, no globals, no DOM. Return HTML strings the
 * `decision-visual-builder` inlines into option cards.
 */

const ICON_LETTER = {
  book: 'B', film: 'F', tv: 'T', game: 'G', music: 'M', user: 'U',
  users: 'U', search: 'Q', settings: 'S', home: 'H', library: 'L',
  inbox: 'I', star: '★', heart: '♥', tag: '#', clock: '⏱', lock: '🔒',
  globe: '⌖', plus: '+', check: '✓', x: '✕', play: '▶', pause: '⏸',
  download: '⬇', upload: '⬆', sync: '⟳', edit: '✎', trash: '🗑',
};

function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function iconHtml(name) {
  if (!name) return '';
  const letter = ICON_LETTER[name] || name.charAt(0).toUpperCase();
  return `<span class="mc-icon" aria-hidden="true">${esc(letter)}</span>`;
}

// ---------------------------------------------------------------------------
// UX flow primitives
// ---------------------------------------------------------------------------

const FLOW_KINDS = new Set(['start', 'step', 'decision', 'end']);

export function buildFlowStep(step = {}, index = 0) {
  const label = esc(step.label || `Step ${index + 1}`);
  const kind = FLOW_KINDS.has(step.kind) ? step.kind : 'step';
  const icon = step.icon ? iconHtml(step.icon) : '';
  return `      <div class="mc-flow-step ${kind}${index === 0 ? ' active' : ''}">
        <span class="mc-flow-num">${index + 1}</span>
        <div class="mc-flow-circle">${icon || index + 1}</div>
        <span class="mc-flow-label">${label}</span>
      </div>`;
}

export function buildFlowDiagram(spec = {}) {
  const steps = Array.isArray(spec.steps) ? spec.steps : [];
  const swimlane = spec.swimlane === 'system' || spec.swimlane === 'user'
    ? ` data-swimlane="${spec.swimlane}"`
    : '';
  const stepEls = steps.map((s, i) => buildFlowStep(s, i)).join('\n');
  return `<div class="mc-flow-timeline"${swimlane}>
${stepEls}
    </div>`;
}

// ---------------------------------------------------------------------------
// UI screen primitives
// ---------------------------------------------------------------------------

const FRAME_KINDS = new Set(['phone', 'desktop', 'modal', 'card']);

export function buildHeader(spec) {
  if (!spec || typeof spec !== 'object') return '';
  const back = spec.back ? '<span class="mc-screen-back" aria-hidden="true">‹</span>' : '';
  const title = spec.title
    ? `<span class="mc-screen-title">${esc(spec.title)}</span>`
    : '<span class="mc-screen-title placeholder"></span>';
  const actions = Array.isArray(spec.actions) && spec.actions.length > 0
    ? `<span class="mc-screen-actions">${spec.actions.map((a) => iconHtml(a)).join('')}</span>`
    : '';
  return `<div class="mc-screen-header">${back}${title}${actions}</div>`;
}

export function buildList(spec) {
  const items = Array.isArray(spec.items) ? spec.items : [];
  const rows = items.map((item, i) => {
    const icon = iconHtml(item.icon);
    const title = esc(item.title || `Item ${i + 1}`);
    const sub = item.subtitle
      ? `<span class="mc-list-sub">${esc(item.subtitle)}</span>`
      : '';
    return `<div class="mc-list-item">${icon}<span class="mc-list-title">${title}</span>${sub}</div>`;
  }).join('');
  return `<div class="mc-list">${rows}</div>`;
}

export function buildGrid(spec) {
  const items = Array.isArray(spec.items) ? spec.items : [];
  const cols = spec.cols === 2 || spec.cols === 3 ? spec.cols : 3;
  const cells = items.map((item, i) => {
    const icon = iconHtml(item.icon);
    const label = esc(item.label || `Cell ${i + 1}`);
    return `<div class="mc-grid-item">${icon}<span class="mc-grid-label">${label}</span></div>`;
  }).join('');
  return `<div class="mc-grid" data-cols="${cols}">${cells}</div>`;
}

export function buildForm(spec) {
  const fields = Array.isArray(spec.fields) ? spec.fields : [];
  const items = fields.map((field) => {
    const kind = ['text', 'select', 'toggle'].includes(field.kind) ? field.kind : 'text';
    const label = esc(field.label || '');
    return `<div class="mc-form-field" data-kind="${kind}">
      <span class="mc-form-label">${label}</span>
      <span class="mc-form-input"></span>
    </div>`;
  }).join('');
  return `<div class="mc-form">${items}</div>`;
}

export function buildHero(spec) {
  const icon = iconHtml(spec.icon);
  const title = esc(spec.title || '');
  const sub = spec.subtitle ? `<div class="mc-hero-sub">${esc(spec.subtitle)}</div>` : '';
  return `<div class="mc-hero">${icon}<div class="mc-hero-title">${title}</div>${sub}</div>`;
}

export function buildText(spec) {
  const lines = Number.isInteger(spec.lines) && spec.lines > 0 ? spec.lines : 3;
  const widths = ['lg', 'md', 'sm', 'lg', 'md', 'sm', 'lg', 'md', 'sm'];
  const rows = Array.from({ length: lines }, (_v, i) => {
    const w = widths[i % widths.length];
    return `<div class="mc-text-placeholder ${w}"></div>`;
  }).join('');
  return `<div class="mc-text-block">${rows}</div>`;
}

export function buildButtons(spec) {
  const items = Array.isArray(spec.items) ? spec.items : [];
  const buttons = items.map((b) => {
    const cls = b && b.primary ? 'mc-button primary' : 'mc-button';
    return `<span class="${cls}">${esc(b.label || '')}</span>`;
  }).join('');
  return `<div class="mc-buttons">${buttons}</div>`;
}

export function buildEmpty(spec) {
  const label = esc((spec && spec.label) || 'Empty');
  return `<div class="mc-empty"><span class="mc-icon" aria-hidden="true">∅</span><span class="mc-empty-label">${label}</span></div>`;
}

const BODY_BUILDERS = {
  list: buildList,
  grid: buildGrid,
  form: buildForm,
  hero: buildHero,
  text: buildText,
  buttons: buildButtons,
  empty: buildEmpty,
};

export function buildBodyElement(element) {
  if (!element || typeof element !== 'object') return '';
  const builder = BODY_BUILDERS[element.kind];
  return builder ? builder(element) : '';
}

export function buildFooter(spec) {
  if (!spec || typeof spec !== 'object') return '';
  if (spec.kind === 'tab-bar') {
    const items = Array.isArray(spec.items) ? spec.items : [];
    const tabs = items.map((t, i) => {
      const active = i === 0 ? ' active' : '';
      return `<span class="mc-tab${active}">${esc(t)}</span>`;
    }).join('');
    return `<div class="mc-screen-footer tab-bar">${tabs}</div>`;
  }
  if (spec.kind === 'action-bar') {
    const items = Array.isArray(spec.items) ? spec.items : [];
    const buttons = items.map((b, i) => {
      const primary = i === items.length - 1 ? ' primary' : '';
      return `<span class="mc-button${primary}">${esc(b)}</span>`;
    }).join('');
    return `<div class="mc-screen-footer action-bar">${buttons}</div>`;
  }
  return '';
}

export function buildScreenMockup(spec = {}) {
  const frame = FRAME_KINDS.has(spec.frame) ? spec.frame : 'phone';
  const header = spec.header ? buildHeader(spec.header) : '';
  const body = Array.isArray(spec.body)
    ? spec.body.map(buildBodyElement).join('')
    : '';
  const footer = spec.footer ? buildFooter(spec.footer) : '';
  return `<div class="mc-screen ${frame}">
    ${header}
    <div class="mc-screen-body">${body}</div>
    ${footer}
  </div>`;
}

// ---------------------------------------------------------------------------
// Architecture primitives
// ---------------------------------------------------------------------------

const NODE_KINDS = new Set([
  'client', 'service', 'db', 'queue', 'cache', 'edge',
  'worker', 'external', 'actor', 'function',
]);
const EDGE_KINDS = new Set(['sync', 'async', 'data', 'dep']);

export function buildArchNode(node = {}) {
  const kind = NODE_KINDS.has(node.kind) ? node.kind : 'service';
  const label = esc(node.label || node.id || kind);
  return `<div class="mc-arch-node ${kind}">${label}</div>`;
}

export function buildArchEdge(edge = {}) {
  const kind = EDGE_KINDS.has(edge.kind) ? edge.kind : 'sync';
  const label = edge.label
    ? `<span class="label">${esc(edge.label)}</span>`
    : '';
  return `<div class="mc-arch-edge ${kind}"><div class="line"></div>${label}</div>`;
}

export function buildArchDiagram(spec = {}) {
  const nodes = Array.isArray(spec.nodes) ? spec.nodes : [];
  const edges = Array.isArray(spec.edges) ? spec.edges : [];
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Walk edges to determine a stable linear order: start at the first node
  // with no incoming edge, follow outgoing edges; nodes not reachable are
  // appended afterward. This keeps the rendered row deterministic.
  const incoming = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of edges) {
    if (incoming.has(e.to)) incoming.set(e.to, incoming.get(e.to) + 1);
  }
  const ordered = [];
  const seen = new Set();
  const queue = nodes.filter((n) => incoming.get(n.id) === 0).map((n) => n.id);
  while (queue.length > 0) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
    for (const e of edges) {
      if (e.from === id && !seen.has(e.to) && byId.has(e.to)) queue.push(e.to);
    }
  }
  for (const n of nodes) if (!seen.has(n.id)) ordered.push(n.id);

  // Build alternating node/edge sequence. Edge between two adjacent nodes
  // is the first edge connecting them in the spec, otherwise a default sync.
  const parts = [];
  for (let i = 0; i < ordered.length; i++) {
    const nodeId = ordered[i];
    const node = byId.get(nodeId);
    if (!node) continue;
    parts.push(buildArchNode(node));
    if (i < ordered.length - 1) {
      const nextId = ordered[i + 1];
      const edge = edges.find((e) => e.from === nodeId && e.to === nextId)
        || edges.find((e) => e.from === nextId && e.to === nodeId)
        || {};
      parts.push(buildArchEdge(edge));
    }
  }
  return `<div class="mc-diagram-surface">
    ${parts.join('\n    ')}
  </div>`;
}

// ---------------------------------------------------------------------------
// Top-level dispatcher
// ---------------------------------------------------------------------------

/**
 * Render a structured visual spec into an HTML fragment.
 *
 * @param {string} category - "ux" | "ui" | "engineering" | "architecture"
 * @param {object} spec - structured spec for the category
 * @returns {string|null} HTML fragment, or null if the spec is unusable
 */
export function renderDiagramSpec(category, spec) {
  if (!spec || typeof spec !== 'object') return null;
  switch (category) {
    case 'ux':
      return buildFlowDiagram(spec);
    case 'ui':
      return buildScreenMockup(spec);
    case 'engineering':
    case 'architecture':
      return buildArchDiagram(spec);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Preset library (Layer 2) — named, feature-shaped variants
// ---------------------------------------------------------------------------

const UX_PRESETS = {
  'wizard-3step': { kind: 'flow', steps: [
    { label: 'Start', kind: 'start' },
    { label: 'Configure', kind: 'step' },
    { label: 'Confirm', kind: 'end' },
  ]},
  'wizard-4step': { kind: 'flow', steps: [
    { label: 'Open', kind: 'start' },
    { label: 'Configure', kind: 'step' },
    { label: 'Submit', kind: 'step' },
    { label: 'Done', kind: 'end' },
  ]},
  approval: { kind: 'flow', steps: [
    { label: 'Trigger', kind: 'start' },
    { label: 'Review', kind: 'decision' },
    { label: 'Approve', kind: 'end' },
  ]},
  'browse-select': { kind: 'flow', steps: [
    { label: 'Browse', kind: 'start' },
    { label: 'Select', kind: 'step' },
    { label: 'Detail', kind: 'step' },
    { label: 'Apply', kind: 'end' },
  ]},
  onboarding: { kind: 'flow', steps: [
    { label: 'Welcome', kind: 'start' },
    { label: 'Profile', kind: 'step' },
    { label: 'Permissions', kind: 'step' },
    { label: 'Done', kind: 'end' },
  ]},
  'search-flow': { kind: 'flow', steps: [
    { label: 'Search', kind: 'start' },
    { label: 'Filter', kind: 'step' },
    { label: 'Result', kind: 'step' },
    { label: 'Detail', kind: 'end' },
  ]},
  'import-flow': { kind: 'flow', steps: [
    { label: 'Source', kind: 'start' },
    { label: 'Map', kind: 'step' },
    { label: 'Preview', kind: 'decision' },
    { label: 'Import', kind: 'end' },
  ]},
  'share-flow': { kind: 'flow', steps: [
    { label: 'Pick', kind: 'start' },
    { label: 'Compose', kind: 'step' },
    { label: 'Send', kind: 'step' },
    { label: 'Confirm', kind: 'end' },
  ]},
  signup: { kind: 'flow', steps: [
    { label: 'Form', kind: 'start' },
    { label: 'Verify', kind: 'decision' },
    { label: 'Profile', kind: 'step' },
    { label: 'Done', kind: 'end' },
  ]},
  signin: { kind: 'flow', steps: [
    { label: 'Credentials', kind: 'start' },
    { label: '2FA', kind: 'decision' },
    { label: 'Home', kind: 'end' },
  ]},
  'decision-tree': { kind: 'flow', steps: [
    { label: 'Question', kind: 'start' },
    { label: 'Branch', kind: 'decision' },
    { label: 'Outcome', kind: 'end' },
  ]},
  'error-recovery': { kind: 'flow', steps: [
    { label: 'Error', kind: 'start' },
    { label: 'Diagnose', kind: 'decision' },
    { label: 'Retry', kind: 'step' },
    { label: 'Success', kind: 'end' },
  ]},
};

const UI_PRESETS = {
  'list-detail': {
    frame: 'phone',
    header: { title: 'List', back: false, actions: ['search'] },
    body: [{ kind: 'list', items: [
      { icon: 'book', title: 'Item A', subtitle: 'detail' },
      { icon: 'book', title: 'Item B', subtitle: 'detail' },
      { icon: 'book', title: 'Item C', subtitle: 'detail' },
      { icon: 'book', title: 'Item D', subtitle: 'detail' },
    ]}],
  },
  'grid-gallery': {
    frame: 'phone',
    header: { title: 'Gallery', actions: ['search'] },
    body: [{ kind: 'grid', cols: 3, items: [
      { icon: 'film', label: 'A' }, { icon: 'film', label: 'B' },
      { icon: 'film', label: 'C' }, { icon: 'film', label: 'D' },
      { icon: 'film', label: 'E' }, { icon: 'film', label: 'F' },
    ]}],
  },
  'form-screen': {
    frame: 'phone',
    header: { title: 'Form', back: true },
    body: [{ kind: 'form', fields: [
      { kind: 'text', label: 'Name' },
      { kind: 'text', label: 'Email' },
      { kind: 'select', label: 'Role' },
      { kind: 'toggle', label: 'Notify me' },
    ]}, { kind: 'buttons', items: [
      { label: 'Cancel' }, { label: 'Save', primary: true },
    ]}],
  },
  dashboard: {
    frame: 'desktop',
    header: { title: 'Dashboard', actions: ['user', 'settings'] },
    body: [{ kind: 'grid', cols: 3, items: [
      { icon: 'star', label: 'Active' }, { icon: 'check', label: 'Done' },
      { icon: 'clock', label: 'Pending' }, { icon: 'tag', label: 'Tags' },
      { icon: 'inbox', label: 'Inbox' }, { icon: 'users', label: 'Team' },
    ]}],
  },
  settings: {
    frame: 'phone',
    header: { title: 'Settings', back: true },
    body: [{ kind: 'form', fields: [
      { kind: 'toggle', label: 'Notifications' },
      { kind: 'toggle', label: 'Dark mode' },
      { kind: 'select', label: 'Language' },
      { kind: 'select', label: 'Region' },
    ]}],
  },
  'search-results': {
    frame: 'phone',
    header: { title: 'Search', actions: ['x'] },
    body: [{ kind: 'list', items: [
      { icon: 'search', title: 'Match A' },
      { icon: 'search', title: 'Match B' },
      { icon: 'search', title: 'Match C' },
    ]}],
  },
  'dialog-confirm': {
    frame: 'modal',
    body: [
      { kind: 'hero', icon: 'check', title: 'Confirm action', subtitle: 'This will be permanent.' },
      { kind: 'buttons', items: [{ label: 'Cancel' }, { label: 'Confirm', primary: true }] },
    ],
  },
  'bottom-sheet': {
    frame: 'phone',
    header: { title: 'Sheet' },
    body: [
      { kind: 'text', lines: 2 },
      { kind: 'list', items: [
        { icon: 'tag', title: 'Option A' },
        { icon: 'tag', title: 'Option B' },
        { icon: 'tag', title: 'Option C' },
      ]},
    ],
  },
  'side-drawer': {
    frame: 'phone',
    body: [{ kind: 'list', items: [
      { icon: 'home', title: 'Home' },
      { icon: 'library', title: 'Library' },
      { icon: 'search', title: 'Search' },
      { icon: 'settings', title: 'Settings' },
    ]}],
    footer: { kind: 'tab-bar', items: ['Home', 'Library', 'Search', 'Me'] },
  },
  'empty-state': {
    frame: 'phone',
    header: { title: 'Library' },
    body: [{ kind: 'empty', label: 'Nothing here yet' }],
  },
  'loading-state': {
    frame: 'phone',
    header: { title: 'Loading' },
    body: [{ kind: 'text', lines: 6 }],
  },
  'hero-cta': {
    frame: 'phone',
    body: [
      { kind: 'hero', icon: 'star', title: 'Welcome', subtitle: 'Get started in seconds.' },
      { kind: 'buttons', items: [{ label: 'Get started', primary: true }] },
    ],
  },
};

const ARCH_PRESETS = {
  'client-server': {
    nodes: [
      { id: 'client', kind: 'client', label: 'Client' },
      { id: 'service', kind: 'service', label: 'Service' },
      { id: 'db', kind: 'db', label: 'Database' },
    ],
    edges: [
      { from: 'client', to: 'service', kind: 'sync', label: 'requests' },
      { from: 'service', to: 'db', kind: 'data', label: 'queries' },
    ],
  },
  'crud-stack': {
    nodes: [
      { id: 'client', kind: 'client', label: 'Client' },
      { id: 'api', kind: 'service', label: 'API' },
      { id: 'db', kind: 'db', label: 'Store' },
    ],
    edges: [
      { from: 'client', to: 'api', kind: 'sync', label: 'REST' },
      { from: 'api', to: 'db', kind: 'data', label: 'CRUD' },
    ],
  },
  'worker-queue': {
    nodes: [
      { id: 'client', kind: 'client', label: 'Client' },
      { id: 'api', kind: 'service', label: 'API' },
      { id: 'queue', kind: 'queue', label: 'Jobs' },
      { id: 'worker', kind: 'worker', label: 'Worker' },
      { id: 'db', kind: 'db', label: 'Store' },
    ],
    edges: [
      { from: 'client', to: 'api', kind: 'sync' },
      { from: 'api', to: 'queue', kind: 'async', label: 'enqueue' },
      { from: 'queue', to: 'worker', kind: 'async' },
      { from: 'worker', to: 'db', kind: 'data' },
    ],
  },
  pubsub: {
    nodes: [
      { id: 'pub', kind: 'service', label: 'Publisher' },
      { id: 'topic', kind: 'queue', label: 'Topic' },
      { id: 'sub', kind: 'worker', label: 'Subscriber' },
    ],
    edges: [
      { from: 'pub', to: 'topic', kind: 'async', label: 'publish' },
      { from: 'topic', to: 'sub', kind: 'async', label: 'fanout' },
    ],
  },
  'cdn-edge': {
    nodes: [
      { id: 'browser', kind: 'client', label: 'Browser' },
      { id: 'cdn', kind: 'edge', label: 'CDN' },
      { id: 'origin', kind: 'service', label: 'Origin' },
      { id: 'db', kind: 'db', label: 'Store' },
    ],
    edges: [
      { from: 'browser', to: 'cdn', kind: 'sync' },
      { from: 'cdn', to: 'origin', kind: 'sync', label: 'miss' },
      { from: 'origin', to: 'db', kind: 'data' },
    ],
  },
  microservices: {
    nodes: [
      { id: 'gw', kind: 'edge', label: 'Gateway' },
      { id: 'a', kind: 'service', label: 'Service A' },
      { id: 'b', kind: 'service', label: 'Service B' },
      { id: 'db', kind: 'db', label: 'Store' },
    ],
    edges: [
      { from: 'gw', to: 'a', kind: 'sync' },
      { from: 'a', to: 'b', kind: 'sync', label: 'rpc' },
      { from: 'b', to: 'db', kind: 'data' },
    ],
  },
  'stream-pipeline': {
    nodes: [
      { id: 'src', kind: 'external', label: 'Source' },
      { id: 'stream', kind: 'queue', label: 'Stream' },
      { id: 'proc', kind: 'worker', label: 'Processor' },
      { id: 'sink', kind: 'db', label: 'Sink' },
    ],
    edges: [
      { from: 'src', to: 'stream', kind: 'async' },
      { from: 'stream', to: 'proc', kind: 'async' },
      { from: 'proc', to: 'sink', kind: 'data' },
    ],
  },
  'cache-aside': {
    nodes: [
      { id: 'client', kind: 'client', label: 'Client' },
      { id: 'cache', kind: 'cache', label: 'Cache' },
      { id: 'db', kind: 'db', label: 'Store' },
    ],
    edges: [
      { from: 'client', to: 'cache', kind: 'sync', label: 'read' },
      { from: 'cache', to: 'db', kind: 'data', label: 'miss' },
    ],
  },
  'read-replica': {
    nodes: [
      { id: 'client', kind: 'client', label: 'Client' },
      { id: 'api', kind: 'service', label: 'API' },
      { id: 'primary', kind: 'db', label: 'Primary' },
      { id: 'replica', kind: 'db', label: 'Replica' },
    ],
    edges: [
      { from: 'client', to: 'api', kind: 'sync' },
      { from: 'api', to: 'primary', kind: 'data', label: 'writes' },
      { from: 'api', to: 'replica', kind: 'data', label: 'reads' },
    ],
  },
  'event-sourced': {
    nodes: [
      { id: 'client', kind: 'client', label: 'Client' },
      { id: 'cmd', kind: 'service', label: 'Command' },
      { id: 'log', kind: 'queue', label: 'Event Log' },
      { id: 'proj', kind: 'db', label: 'Projection' },
    ],
    edges: [
      { from: 'client', to: 'cmd', kind: 'sync' },
      { from: 'cmd', to: 'log', kind: 'async', label: 'append' },
      { from: 'log', to: 'proj', kind: 'async' },
    ],
  },
  'static-site': {
    nodes: [
      { id: 'build', kind: 'function', label: 'Build' },
      { id: 'storage', kind: 'db', label: 'Storage' },
      { id: 'cdn', kind: 'edge', label: 'CDN' },
      { id: 'browser', kind: 'client', label: 'Browser' },
    ],
    edges: [
      { from: 'build', to: 'storage', kind: 'data' },
      { from: 'storage', to: 'cdn', kind: 'data' },
      { from: 'cdn', to: 'browser', kind: 'sync' },
    ],
  },
  serverless: {
    nodes: [
      { id: 'trigger', kind: 'external', label: 'Trigger' },
      { id: 'fn', kind: 'function', label: 'Function' },
      { id: 'store', kind: 'db', label: 'Storage' },
    ],
    edges: [
      { from: 'trigger', to: 'fn', kind: 'async' },
      { from: 'fn', to: 'store', kind: 'data' },
    ],
  },
};

export const PRESETS = Object.freeze({
  ux: UX_PRESETS,
  ui: UI_PRESETS,
  engineering: ARCH_PRESETS,
  architecture: ARCH_PRESETS,
});

/**
 * Resolve a preset name into an HTML fragment for the given category.
 * Returns null if the preset isn't known.
 *
 * @param {string} category - "ux" | "ui" | "engineering" | "architecture"
 * @param {string} name
 * @returns {string|null}
 */
export function renderPreset(category, name) {
  const table = PRESETS[category];
  if (!table) return null;
  const spec = table[name];
  if (!spec) return null;
  return renderDiagramSpec(category, spec);
}

/**
 * List preset names available for a category. Useful for tests and docs.
 */
export function listPresets(category) {
  const table = PRESETS[category];
  return table ? Object.keys(table).sort() : [];
}
