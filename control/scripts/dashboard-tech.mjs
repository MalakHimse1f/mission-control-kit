import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import {
  escapeHtml,
  sortByOrder,
  computeTechStage,
  taskProgress,
  techStackOrderLabel,
  buildTaskList,
  buildTaskRows,
  sortTasks,
} from "./dashboard-helpers.mjs";

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function readText(path) {
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}

export function listTechItems(control) {
  const dir = join(control, "tech-stack");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => {
    if (name.startsWith("_") || name.startsWith(".")) return false;
    if (name.endsWith(".md") || name.endsWith(".json")) return false;
    return statSync(join(dir, name)).isDirectory();
  });
}

function buildTechCard(control, slug, status, global, orderIndex) {
  const stage = computeTechStage(control, slug, status);
  const progress = taskProgress(status?.tasks);
  const isActive = global?.activeTechSlug === slug;
  const orderNum = orderIndex >= 0 ? orderIndex + 1 : "—";
  const progressBar =
    progress.total > 0
      ? `<div class="progress-bar" role="progressbar" aria-valuenow="${progress.pct}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-fill progress-fill-tech" style="width:${progress.pct}%"></div>
        </div>
        <p class="progress-label">${progress.done}/${progress.total} tasks (${progress.pct}%)</p>`
      : `<p class="muted progress-label">No build tasks yet</p>`;

  return `<article class="portfolio-card tech-card stage-${stage.key}${isActive ? " is-active" : ""}" data-tech="${escapeHtml(slug)}">
    <div class="card-header">
      <span class="build-order">#${orderNum}</span>
      <h3>${escapeHtml(slug)}</h3>
      ${isActive ? `<span class="badge badge-progress">active</span>` : ""}
    </div>
    <p class="stage-label"><span class="badge stage-badge">${escapeHtml(stage.label)}</span> <span class="muted">setup</span></p>
    <p class="meta">Spec: ${escapeHtml(status?.specStatus ?? "—")}</p>
    ${progressBar}
    <button type="button" class="btn btn-sm focus-tech" data-focus-tech="${escapeHtml(slug)}">View tasks</button>
  </article>`;
}

export function buildTechStackPanel(control, global) {
  const stack = readJson(join(control, "tech-stack", "stack.json")) ?? {};
  const contextExcerpt = readText(join(control, "tech-stack", "CONTEXT.md"))
    .split("\n")
    .slice(0, 8)
    .join("\n")
    .trim();
  const items = listTechItems(control);
  const order = global?.techStackOrder ?? [];
  const ordered = sortByOrder(items, order);

  const needsInit =
    stack.techStackStatus !== "established" && global?.techStackStatus !== "established";
  const initNotice = needsInit
    ? `<p class="notice">Run <code>/mc-init</code> first to establish tech stack context (required before braindump).</p>`
    : "";

  const summary =
    stack.summary ||
    (stack.frameworks?.length ? stack.frameworks.join(", ") : null) ||
    "—";

  const cards = ordered
    .map((slug) => {
      const status = readJson(join(control, "tech-stack", slug, "status.json"));
      return buildTechCard(control, slug, status, global, order.indexOf(slug));
    })
    .join("\n");

  return `<div class="panel span-2 tech-stack-panel">
    <h2>Tech stack</h2>
    <p class="muted">App setup and configuration — separate from user-facing features.</p>
    ${initNotice}
    <p class="meta"><strong>Context:</strong> ${escapeHtml(summary)} · Mode: ${escapeHtml(stack.projectMode ?? global?.projectMode ?? "—")}</p>
    <p class="links"><a href="tech-stack/CONTEXT.md">CONTEXT.md</a> · <a href="tech-stack/stack.json">stack.json</a> · <a href="WORKSTREAMS.md">WORKSTREAMS.md</a></p>
    ${contextExcerpt && !needsInit ? `<details class="context-details"><summary>Stack notes</summary><pre class="context-pre">${escapeHtml(contextExcerpt)}</pre></details>` : ""}
    <p class="muted build-order-line"><strong>Setup order:</strong> ${escapeHtml(techStackOrderLabel(order))}</p>
    <div class="portfolio-grid">${cards || `<p class="muted">No setup items yet. Greenfield: <code>/mc-init</code>. Add one: <code>/mc-braindump</code> (classify as setup).</p>`}</div>
  </div>`;
}

export function buildTechNav(items, activeTech) {
  if (items.length <= 1) return "";
  const buttons = items
    .map(
      (slug) =>
        `<button type="button" class="nav-btn nav-btn-tech${activeTech === slug ? " active" : ""}" data-filter-tech="${escapeHtml(slug)}">${escapeHtml(slug)}</button>`,
    )
    .join("\n");
  return `<nav class="feature-nav" aria-label="Filter tech stack items">
    <button type="button" class="nav-btn nav-btn-tech active" data-filter-tech="all">All setup items</button>
    ${buttons}
  </nav>`;
}

export function buildTechItemSection(control, slug, { collapsed = false } = {}) {
  const status = readJson(join(control, "tech-stack", slug, "status.json"));
  const stage = computeTechStage(control, slug, status);
  const specPath = join(control, "tech-stack", slug, "spec.md");
  const specExists = existsSync(specPath);

  return `<section class="feature-block tech-block${collapsed ? " is-collapsed" : ""}" id="tech-${escapeHtml(slug)}" data-tech="${escapeHtml(slug)}">
    <header class="feature-header">
      <button type="button" class="feature-toggle" aria-expanded="${collapsed ? "false" : "true"}">
        <span class="toggle-icon">${collapsed ? "▸" : "▾"}</span>
        <h2>${escapeHtml(slug)}</h2>
        <span class="badge stage-badge">${escapeHtml(stage.label)}</span>
        <span class="badge">setup</span>
      </button>
    </header>
    <div class="feature-body">
    <p class="meta">
      Spec: ${status?.specStatus ?? "—"} ·
      Task: <code>${escapeHtml(status?.currentTaskId ?? "—")}</code> ·
      Branch: <code>${escapeHtml(status?.branch ?? "—")}</code>
    </p>
    <p class="links">
      ${specExists ? `<a href="tech-stack/${escapeHtml(slug)}/spec.md">spec.md</a>` : ""}
      · <a href="tech-stack/${escapeHtml(slug)}/status.json">status.json</a>
      · <a href="tech-stack/${escapeHtml(slug)}/phases/">phases/</a>
    </p>
    <h3>Tasks <span class="muted">(implementation order)</span></h3>
    ${buildTaskList(status?.tasks)}
    <details class="task-details">
      <summary>Task details</summary>
    <table>
      <thead>
        <tr>
          <th>ID</th><th>Title</th><th>Status</th><th>Updated</th>
          <th>Commit</th><th>Spec</th><th>Code</th><th>Notes</th>
        </tr>
      </thead>
      <tbody>${buildTaskRows(sortTasks(status?.tasks))}</tbody>
    </table>
    </details>
    </div>
  </section>`;
}
