/**
 * v5 feature documentation renderers.
 *
 * Pure functions: take the data shapes produced by `lib/v5/feature-docs.mjs`
 * and return HTML fragment strings. No file IO, no globals.
 *
 * CSS hooks (styled by Task 5 in feature.css):
 *   - .doc-empty            empty-state message
 *   - .doc-md               markdown-ish text container (whitespace preserved)
 *   - .doc-tasks            tasks list wrapper
 *   - .task-group           grouped section by status
 *   - .task-item            single task li
 *   - .status-pill          status indicator
 *   - .commit-link          short commit hash display
 *   - .doc-disclosure       <details> wrapper for collapsible content
 *   - .doc-iframe           sandboxed iframe for explore HTML
 *   - .doc-explore-item     wrapper around each explore doc
 *   - .doc-wireframes-grid  wireframe gallery container
 *   - .iframe-card          single wireframe card
 *
 * Task 5 wires these into render-feature.mjs and styles the classes.
 */

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

/**
 * Render spec.md content.
 *
 * @param {{ exists: boolean, content: string, path?: string }} spec
 * @returns {string}
 */
export function renderSpec(spec) {
  if (!spec || !spec.exists) {
    return '<div class="doc-empty">No spec yet — subagents will write spec.md as the PRD is generated.</div>';
  }
  return `<article class="doc-md"><pre>${escapeHtml(spec.content)}</pre></article>`;
}

const TASK_GROUP_ORDER = ['done', 'in-progress', 'pending'];
const TASK_GROUP_LABEL = {
  done: 'Done',
  'in-progress': 'In progress',
  pending: 'Pending',
  other: 'Other',
};

/**
 * Render the tasks list, grouped by status.
 *
 * @param {Array<{ id: string, title: string, status: string, commit?: string }>} tasks
 * @returns {string}
 */
export function renderTasks(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return '<div class="doc-empty">No tasks recorded yet.</div>';
  }
  const groups = { done: [], 'in-progress': [], pending: [], other: [] };
  for (const t of tasks) {
    const status = (t && t.status) || '';
    if (groups[status]) groups[status].push(t);
    else groups.other.push(t);
  }
  const sections = [];
  const order = [...TASK_GROUP_ORDER, 'other'];
  for (const key of order) {
    const items = groups[key];
    if (!items || items.length === 0) continue;
    const lis = items
      .map((t) => {
        const status = (t && t.status) || '';
        const title = (t && t.title) || '';
        const commitFull = t && typeof t.commit === 'string' ? t.commit : '';
        const commitShort = commitFull.slice(0, 7);
        const commitHtml = commitShort
          ? ` <span class="commit-link">${escapeHtml(commitShort)}</span>`
          : '';
        return `<li class="task-item"><span class="status-pill ${escapeAttr(status)}">${escapeHtml(status)}</span><span class="task-title">${escapeHtml(title)}</span>${commitHtml}</li>`;
      })
      .join('');
    sections.push(
      `<section class="task-group" data-status="${escapeAttr(key)}"><h3>${escapeHtml(TASK_GROUP_LABEL[key])} (${items.length})</h3><ul>${lis}</ul></section>`,
    );
  }
  return `<div class="doc-tasks">${sections.join('')}</div>`;
}

/**
 * Render phase plans as collapsible disclosures. First one open by default.
 *
 * @param {Array<{ file: string, label: string, content: string }>} phases
 * @returns {string}
 */
export function renderPhases(phases) {
  if (!Array.isArray(phases) || phases.length === 0) {
    return '<div class="doc-empty">No phase plans yet.</div>';
  }
  return phases
    .map((p, idx) => {
      const open = idx === 0 ? ' open' : '';
      const label = (p && p.label) || '';
      const content = (p && p.content) || '';
      return `<details class="doc-disclosure"${open}><summary>${escapeHtml(label)}</summary><pre class="doc-md">${escapeHtml(content)}</pre></details>`;
    })
    .join('');
}

/**
 * Render journal entries as collapsible disclosures.
 *
 * @param {Array<{ file: string, label: string, content: string }>} entries
 * @returns {string}
 */
export function renderJournal(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return '<div class="doc-empty">No journal entries yet.</div>';
  }
  return entries
    .map((entry, idx) => {
      const open = idx === 0 ? ' open' : '';
      const label = (entry && entry.label) || '';
      const content = (entry && entry.content) || '';
      return `<details class="doc-disclosure"${open}><summary>${escapeHtml(label)}</summary><pre class="doc-md">${escapeHtml(content)}</pre></details>`;
    })
    .join('');
}

/**
 * Render exploration docs.
 *  - HTML docs → sandboxed iframe with the HTML as srcdoc.
 *  - MD docs   → collapsible disclosure with <pre> content.
 *
 * @param {Array<{ name: string, format: 'html'|'md', content: string }>} items
 * @returns {string}
 */
export function renderExplore(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return '<div class="doc-empty">No exploration docs yet.</div>';
  }
  return items
    .map((item) => {
      const name = (item && item.name) || '';
      const content = (item && item.content) || '';
      if (item && item.format === 'html') {
        const srcdoc = escapeAttr(content);
        return `<div class="doc-explore-item"><h3>${escapeHtml(name)}</h3><iframe class="doc-iframe" srcdoc="${srcdoc}" sandbox="allow-same-origin"></iframe></div>`;
      }
      return `<div class="doc-explore-item"><details class="doc-disclosure"><summary>${escapeHtml(name)}</summary><pre class="doc-md">${escapeHtml(content)}</pre></details></div>`;
    })
    .join('');
}

/**
 * Render wireframes as a grid of sandboxed iframe cards.
 *
 * @param {Array<{ id: string, label: string, html: string }>} items
 * @returns {string}
 */
export function renderWireframes(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return '<div class="doc-empty">No wireframes yet.</div>';
  }
  const cards = items
    .map((w) => {
      const label = (w && w.label) || '';
      const html = (w && w.html) || '';
      const srcdoc = escapeAttr(html);
      return `<div class="iframe-card"><h4>${escapeHtml(label)}</h4><iframe srcdoc="${srcdoc}" sandbox="allow-same-origin"></iframe></div>`;
    })
    .join('');
  return `<div class="doc-wireframes-grid">${cards}</div>`;
}

// Exported for tests
export const __test__ = { escapeHtml, escapeAttr };
