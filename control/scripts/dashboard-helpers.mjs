import { readdirSync, existsSync } from "fs";
import { join } from "path";

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function sortFeaturesByBuildOrder(features, buildOrder) {
  if (!buildOrder?.length) return [...features].sort();
  const rank = new Map(buildOrder.map((slug, i) => [slug, i]));
  return [...features].sort((a, b) => {
    const ia = rank.has(a) ? rank.get(a) : 999;
    const ib = rank.has(b) ? rank.get(b) : 999;
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b);
  });
}

const PIPELINE_STAGE_META = {
  braindump: { key: "braindump", label: "Braindump", step: 1 },
  explore: { key: "explore", label: "Explore codebases", step: 2 },
  clarify: { key: "clarify", label: "Clarify requirements", step: 3 },
  prd: { key: "prd", label: "Write PRD", step: 4 },
  mock: { key: "mock", label: "UI mock diagrams", step: 5 },
  plan: { key: "plan", label: "Platform plans", step: 6 },
  build: { key: "build", label: "Building", step: 7 },
  validate: { key: "validate", label: "Validate", step: 8 },
  done: { key: "done", label: "Complete", step: 9 },
};

export function pipelineStageMeta(stage) {
  return PIPELINE_STAGE_META[stage] ?? PIPELINE_STAGE_META.braindump;
}

export function computeFeatureStage(controlRoot, slug, status) {
  if (status?.pipelineStage && PIPELINE_STAGE_META[status.pipelineStage]) {
    return pipelineStageMeta(status.pipelineStage);
  }

  const phasesDir = join(controlRoot, "features", slug, "phases");
  const hasPhases =
    existsSync(phasesDir) &&
    readdirSync(phasesDir).some((f) => f.endsWith(".md") && !f.startsWith("README"));

  if (status?.specStatus !== "approved") {
    return { key: "prd", label: "PRD in progress", step: 4 };
  }
  if (status?.layoutStatus !== "approved") {
    return { key: "mock", label: "UI mocks", step: 5 };
  }
  if (!hasPhases) {
    return { key: "plan", label: "Platform plans", step: 6 };
  }

  const tasks = status?.tasks ?? [];
  if (!tasks.length) {
    return { key: "plan", label: "Plan written", step: 6 };
  }

  const done = tasks.filter((t) => t.status === "done").length;
  if (done === tasks.length) {
    return { key: "done", label: "Complete", step: 9 };
  }
  return { key: "build", label: "Building", step: 7 };
}

export function taskProgress(tasks) {
  if (!tasks?.length) return { done: 0, total: 0, pct: 0 };
  const done = tasks.filter((t) => t.status === "done").length;
  const total = tasks.length;
  return { done, total, pct: Math.round((done / total) * 100) };
}

export function buildOrderLabel(buildOrder, portfolioReviewStatus) {
  if (portfolioReviewStatus === "approved" && buildOrder?.length) {
    return buildOrder.map((s, i) => `${i + 1}. ${s}`).join(" → ");
  }
  if (buildOrder?.length) {
    return `${buildOrder.join(" → ")} (draft — approve via /mc-portfolio)`;
  }
  return "Not set — run /mc-portfolio when you have 2+ approved specs";
}

export function sortByOrder(slugs, order) {
  return sortFeaturesByBuildOrder(slugs, order);
}

export function listWorkstreamSlugs(controlRoot, workstream) {
  const subdir = workstream === "tech-stack" ? "tech-stack" : "features";
  const dir = join(controlRoot, subdir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => {
    if (name.startsWith("_") || name.startsWith(".")) return false;
    if (name === "stack.json" || name.endsWith(".md") || name.endsWith(".json")) return false;
    try {
      return existsSync(join(dir, name)) && readdirSync(join(dir, name)).length >= 0;
    } catch {
      return false;
    }
  }).filter((name) => existsSync(join(dir, name, "status.json")) || existsSync(join(dir, name, "spec.md")));
}

export function computeTechStage(controlRoot, slug, status) {
  const phasesDir = join(controlRoot, "tech-stack", slug, "phases");
  const hasPhases =
    existsSync(phasesDir) &&
    readdirSync(phasesDir).some((f) => f.endsWith(".md") && !f.startsWith("README"));

  if (status?.specStatus !== "approved") {
    return { key: "spec", label: "Spec in progress", step: 1 };
  }
  if (!hasPhases) {
    return { key: "plan", label: "Ready for plan", step: 2 };
  }

  const tasks = status?.tasks ?? [];
  if (!tasks.length) {
    return { key: "plan", label: "Plan written", step: 2 };
  }

  const done = tasks.filter((t) => t.status === "done").length;
  if (done === tasks.length) {
    return { key: "done", label: "Complete", step: 4 };
  }
  return { key: "build", label: "Building", step: 3 };
}

export function techStackOrderLabel(order) {
  if (!order?.length) return "Not set — add items via /mc-init or /mc-braindump";
  return order.map((s, i) => `${i + 1}. ${s}`).join(" → ");
}

function compareTaskIds(a, b) {
  const parts = (id) => String(id).split(".").map((n) => parseInt(n, 10) || 0);
  const pa = parts(a.id);
  const pb = parts(b.id);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return String(a.id).localeCompare(String(b.id));
}

export function sortTasks(tasks) {
  if (!tasks?.length) return [];
  return [...tasks].sort(compareTaskIds);
}

export function taskCheckmark(status) {
  if (status === "done") return `<span class="task-check done" aria-label="done">✓</span>`;
  if (status === "in-progress") return `<span class="task-check progress" aria-label="in progress">◉</span>`;
  if (status === "blocked") return `<span class="task-check blocked" aria-label="blocked">!</span>`;
  return `<span class="task-check pending" aria-label="pending">○</span>`;
}

export function statusBadge(status) {
  const map = {
    backlog: "badge-backlog",
    "in-progress": "badge-progress",
    done: "badge-done",
    blocked: "badge-blocked",
  };
  const cls = map[status] ?? "badge-backlog";
  return `<span class="badge ${cls}">${escapeHtml(status ?? "unknown")}</span>`;
}

function reviewBadge(val) {
  if (!val) return "—";
  const cls = val === "pass" ? "badge-done" : "badge-blocked";
  return `<span class="badge ${cls}">${escapeHtml(val)}</span>`;
}

export function buildTaskList(tasks, { compact = false } = {}) {
  const sorted = sortTasks(tasks);
  if (!sorted.length) {
    return `<p class="muted">No tasks yet</p>`;
  }
  return `<ol class="task-list">
${sorted
  .map((t) => {
    const done = t.status === "done";
    const meta = done && t.commit
      ? `<span class="task-meta"><code>${escapeHtml(t.commit.slice(0, 7))}</code></span>`
      : t.status === "in-progress"
        ? `<span class="task-meta">in progress</span>`
        : t.status === "blocked"
          ? `<span class="task-meta">blocked</span>`
          : "";
    return `    <li class="task-item task-${escapeHtml(t.status ?? "backlog")}${done ? " is-done" : ""}">
      ${taskCheckmark(t.status)}
      <span class="task-label"><code>${escapeHtml(t.id)}</code> ${escapeHtml(t.title ?? "")}${compact ? "" : meta ? ` ${meta}` : ""}</span>
    </li>`;
  })
  .join("\n")}
  </ol>`;
}

export function buildTaskRows(tasks) {
  if (!tasks?.length) {
    return `<tr><td colspan="8" class="muted">No tasks yet</td></tr>`;
  }
  return tasks
    .map(
      (t) => `<tr>
        <td><code>${escapeHtml(t.id)}</code></td>
        <td>${escapeHtml(t.title ?? "")}</td>
        <td>${statusBadge(t.status)}</td>
        <td class="muted">${escapeHtml(t.updatedAt ?? "—")}</td>
        <td>${t.commit ? `<code>${escapeHtml(t.commit.slice(0, 7))}</code>` : "—"}</td>
        <td>${reviewBadge(t.specReview)}</td>
        <td>${reviewBadge(t.codeReview)}</td>
        <td>${t.notes ? escapeHtml(t.notes) : "—"}</td>
      </tr>`,
    )
    .join("\n");
}
