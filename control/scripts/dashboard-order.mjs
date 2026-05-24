import { buildOrderLabel, techStackOrderLabel, escapeHtml } from "./dashboard-helpers.mjs";

/** @typedef {{ position: number, slug: string, stage: string, stageKey: string, inProgress: boolean }} OrderEntry */

/**
 * @param {Record<string, unknown>} global
 * @param {Array<{ id: string, workstream: string, stage: string, stageKey: string, inProgress: boolean, order: number|null }>} rows
 */
export function collectOrderSummary(global, rows) {
  const byId = new Map(rows.map((r) => [r.id, r]));

  /** @param {string[]} order @param {"feature"|"tech-stack"} workstream */
  function mapOrder(order, workstream) {
    if (!order?.length) return [];
    return order
      .map((slug, i) => {
        const row = byId.get(slug);
        if (row && row.workstream !== workstream) return null;
        return {
          position: i + 1,
          slug,
          stage: row?.stage ?? "Not on disk",
          stageKey: row?.stageKey ?? "spec",
          inProgress: row?.inProgress ?? false,
        };
      })
      .filter(Boolean);
  }

  const buildOrder = global?.buildOrder ?? [];
  const techStackOrder = global?.techStackOrder ?? [];
  const portfolioReviewStatus = global?.portfolioReviewStatus ?? null;

  const featureStatus =
    portfolioReviewStatus === "approved"
      ? "approved"
      : buildOrder.length >= 2
        ? "draft"
        : buildOrder.length === 1
          ? "single"
          : "unset";

  return {
    features: {
      items: mapOrder(buildOrder, "feature"),
      status: featureStatus,
      label: buildOrderLabel(buildOrder, portfolioReviewStatus),
    },
    tech: {
      items: mapOrder(techStackOrder, "tech-stack"),
      label: techStackOrderLabel(techStackOrder),
    },
    unorderedFeatures: rows
      .filter((r) => r.workstream === "feature" && r.order == null)
      .map((r) => r.id),
    unorderedTech: rows
      .filter((r) => r.workstream === "tech-stack" && r.order == null)
      .map((r) => r.id),
  };
}

export function defaultDashboardSort(global) {
  if (global?.portfolioReviewStatus === "approved" && (global?.buildOrder?.length ?? 0) > 1) {
    return "order";
  }
  if ((global?.techStackOrder?.length ?? 0) > 1 && !(global?.buildOrder?.length)) {
    return "order";
  }
  return "lastUpdated";
}

function statusBadge(status) {
  const map = {
    approved: ["order-badge-approved", "Approved"],
    draft: ["order-badge-draft", "Draft — run /mc-portfolio"],
    single: ["order-badge-single", "Single feature"],
    unset: ["order-badge-unset", "Not set"],
  };
  const [cls, label] = map[status] ?? map.unset;
  return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
}

function renderOrderList(items, emptyMsg) {
  if (!items.length) {
    return `<p class="muted">${escapeHtml(emptyMsg)}</p>`;
  }
  return `<ol class="order-list">${items
    .map(
      (e) =>
        `<li class="order-item" data-id="${escapeHtml(e.slug)}" tabindex="0" role="button">` +
        `<span class="order-num">${e.position}</span>` +
        `<span class="order-slug"><strong>${escapeHtml(e.slug)}</strong></span>` +
        `<span class="badge badge-${escapeHtml(e.stageKey)}">${escapeHtml(e.stage)}</span>` +
        (e.inProgress ? '<span class="badge badge-working">Active</span>' : "") +
        `</li>`,
    )
    .join("")}</ol>`;
}

export function renderBuildOrderPanel(orderSummary) {
  const { features, tech, unorderedFeatures, unorderedTech } = orderSummary;
  let html = `<div class="order-columns">`;

  html += `<div class="order-column">
    <div class="order-column-head">
      <h3>UX features</h3>
      ${statusBadge(features.status)}
    </div>
    ${renderOrderList(features.items, "No build order yet — run <code>/mc-portfolio</code> after 2+ approved specs.")}
    <p class="order-hint muted">${escapeHtml(features.label)}</p>`;

  if (unorderedFeatures.length) {
    html += `<p class="order-unlisted muted">Not in order: ${unorderedFeatures.map((s) => `<code>${escapeHtml(s)}</code>`).join(", ")}</p>`;
  }
  html += `</div>`;

  html += `<div class="order-column">
    <div class="order-column-head"><h3>Tech setup</h3></div>
    ${renderOrderList(tech.items, "No setup order — items appear as you add them via <code>/mc-init</code> or <code>/mc-braindump</code>.")}
    <p class="order-hint muted">${escapeHtml(tech.label)}</p>`;
  if (unorderedTech.length) {
    html += `<p class="order-unlisted muted">Not in order: ${unorderedTech.map((s) => `<code>${escapeHtml(s)}</code>`).join(", ")}</p>`;
  }
  html += `</div></div>`;

  return html;
}

export function orderBadgeHtml(order) {
  if (order == null) return "";
  return `<span class="order-badge" title="Build order">#${order}</span>`;
}
