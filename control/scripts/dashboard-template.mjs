import { escapeHtml, safeJsonForScriptEmbed } from "./dashboard-helpers.mjs";
import { renderBuildOrderPanel } from "./dashboard-order.mjs";
import { renderUserGuideDisclosure } from "./dashboard-guide.mjs";
import {
  renderControlPanel,
  CONTROL_PANEL_CSS,
  CONTROL_PANEL_CLIENT_JS,
} from "./dashboard-control-panel.mjs";
import {
  renderWorkflowPanel,
  WORKFLOW_PANEL_CSS,
  WORKFLOW_PANEL_CLIENT_JS,
} from "./dashboard-workflow-panel.mjs";
import { renderKitVersionStrip, KIT_VERSION_CLIENT_JS } from "./dashboard-kit-version.mjs";

export const DASHBOARD_CSS = `
:root { color-scheme: dark;
  --bg:#0f0f11; --panel:#17181b; --panel-2:#1c1d21; --raised:#212227;
  --ink:#ededee; --ink-soft:#a6a7ac; --muted:#6f7177;
  --border:#2a2c31; --line-2:#3a3d44; --accent:#e8e8ea;
  --ok:#7fb38a; --warn:#c9a86a; --stop:#c98a8a; }
* { box-sizing: border-box; }
body { font-family: ui-sans-serif, system-ui, sans-serif; background: var(--bg); color: var(--ink); margin: 0; padding: 1.25rem 1.5rem 2rem; line-height: 1.45; }
h1 { font-size: 1.45rem; margin: 0 0 0.25rem; font-weight: 600; }
.subtitle { color: var(--ink-soft); font-size: 0.9rem; margin: 0 0 1.25rem; }
.top-meta { font-size: 0.78rem; color: var(--muted); margin-bottom: 1rem; }
.top-meta a { color: var(--ink-soft); }
.panel { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 1rem 1.15rem; margin-bottom: 1rem; }
.panel h2 { font-size: 1.05rem; margin: 0 0 0.65rem; font-weight: 600; border: none; padding: 0; }
.muted { color: var(--muted); }
.notice { background: var(--panel-2); border: 1px solid var(--border); border-radius: 8px; padding: 0.65rem 0.85rem; font-size: 0.88rem; margin-bottom: 0.85rem; }
.progress-table { width: 100%; border-collapse: collapse; font-size: 0.84rem; margin-top: 0.5rem; }
.progress-table th, .progress-table td { border-bottom: 1px solid var(--border); padding: 0.55rem 0.5rem; text-align: left; vertical-align: middle; }
.progress-table th { color: var(--muted); font-weight: 500; font-size: 0.78rem; }
.progress-table tbody tr { cursor: pointer; }
.progress-table tbody tr:hover { background: var(--panel-2); }
.progress-table .pickup-col { width: 1%; white-space: nowrap; text-align: right; }
.toolbar { display: flex; flex-wrap: wrap; gap: 0.65rem; align-items: center; margin-bottom: 0.75rem; }
.toolbar label { font-size: 0.82rem; color: var(--muted); display: flex; align-items: center; gap: 0.35rem; }
.toolbar input, .toolbar select { background: var(--panel-2); border: 1px solid var(--border); color: var(--ink); border-radius: 6px; padding: 0.35rem 0.55rem; font-size: 0.82rem; }
.toolbar input { min-width: 10rem; }
.work-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.75rem; }
.work-card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 0.85rem 1rem; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.work-card:hover { border-color: var(--line-2); background: var(--panel-2); }
.work-card.selected { border-color: var(--line-2); background: var(--panel-2); box-shadow: 0 0 0 1px var(--line-2); }
.work-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.4rem; }
.work-card-name { font-weight: 600; font-size: 0.95rem; margin: 0; line-height: 1.25; }
.work-card-type { font-size: 0.72rem; color: var(--muted); white-space: nowrap; }
.work-card-meta { font-size: 0.78rem; color: var(--muted); margin: 0.25rem 0 0.5rem; }
.work-card-task { font-size: 0.78rem; margin: 0.35rem 0 0; line-height: 1.35; }
.work-card-task code { font-size: 0.75rem; }
.work-card-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.65rem; }
.work-card-actions .btn { flex: 1 1 auto; }
.empty-cards { grid-column: 1 / -1; text-align: center; color: var(--muted); padding: 2rem 1rem; border: 1px dashed var(--border); border-radius: 10px; }
.progress-cell { min-width: 0; }
.progress-bar { height: 5px; background: #0c0c0e; border-radius: 3px; overflow: hidden; margin-top: 0.2rem; }
.progress-fill { height: 100%; background: var(--ink-soft); border-radius: 3px; }
.progress-fill-tech { background: var(--ink-soft); }
.detail-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.pickup-pre { background: #0c0c0e; border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem; font-size: 0.8rem; white-space: pre-wrap; margin: 0.75rem 0; max-height: 12rem; overflow: auto; }
.task-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.task-table th, .task-table td { border-bottom: 1px solid var(--border); padding: 0.4rem 0.45rem; text-align: left; }
.task-table tr.task-in-progress td { color: var(--ink); font-weight: 500; background: var(--raised); }
.task-table tr.task-done td { color: var(--muted); }
.handoff-collapsed summary { cursor: pointer; color: var(--muted); font-size: 0.88rem; margin-bottom: 0.5rem; }
.handoff-pre { white-space: pre-wrap; font-size: 0.8rem; background: #0c0c0e; border: 1px solid var(--border); padding: 0.65rem; border-radius: 8px; max-height: 10rem; overflow: auto; }
.stack-line { font-size: 0.85rem; color: var(--ink-soft); margin-bottom: 0.5rem; }
.footer { margin-top: 1.5rem; font-size: 0.72rem; color: var(--muted); }
.visual-grid { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 0.5rem; }
.wireframe-card, .shot-card { margin: 0; flex: 1 1 280px; max-width: 420px; background: #0c0c0e; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.wireframe-card iframe { display: block; width: 100%; height: 360px; border: none; background: #fff; }
.research-card iframe { height: 420px; }
.wireframe-card figcaption, .shot-card figcaption { font-size: 0.75rem; color: var(--muted); padding: 0.45rem 0.6rem; border-top: 1px solid var(--border); }
.shot-card img { display: block; width: 100%; height: auto; max-height: 280px; object-fit: contain; background: #0c0c0e; }
.btn { background: transparent; color: var(--ink); border: 1px solid var(--line-2); padding: 0.35rem 0.65rem; border-radius: 6px; cursor: pointer; font-size: 0.78rem; white-space: nowrap; }
.btn:hover { border-color: #52565e; }
.btn-primary { background: var(--accent); color: #161616; border-color: var(--accent); }
.btn-sm { padding: 0.25rem 0.5rem; font-size: 0.72rem; }
.badge { display: inline-block; padding: 0.12rem 0.45rem; border-radius: 999px; font-size: 0.72rem; border: 1px solid var(--line-2); color: var(--ink-soft); }
.badge-build { color: #bfe3f0; border-color: #2c3a44; background: #141b20; }
.badge-spec, .badge-layout, .badge-plan, .badge-braindump, .badge-explore, .badge-clarify, .badge-prd, .badge-mock { color: var(--ink-soft); }
.step-timeline { list-style: none; padding: 0; margin: 0.5rem 0 0; }
.step-item { display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.4rem 0; border-bottom: 1px solid var(--border); font-size: 0.82rem; }
.step-dot { width: 0.65rem; height: 0.65rem; border-radius: 50%; margin-top: 0.25rem; flex-shrink: 0; border: 1px solid var(--line-2); background: var(--raised); }
.step-item.step-done .step-dot { background: var(--ok); border-color: var(--ok); }
.step-item.step-in-progress .step-dot { background: var(--ink-soft); border-color: var(--ink-soft); }
.step-item.step-blocked .step-dot { background: var(--stop); border-color: var(--stop); }
.step-body { flex: 1; min-width: 0; }
.step-label { font-weight: 500; }
.step-meta { font-size: 0.72rem; color: var(--muted); }
.doc-wrap { margin: 0.5rem 0 1rem; }
.doc-title { font-size: 0.85rem; margin: 0 0 0.35rem; color: var(--ink-soft); font-weight: 600; }
.doc-block { white-space: pre-wrap; font-size: 0.78rem; background: #0c0c0e; border: 1px solid var(--border); padding: 0.75rem; border-radius: 8px; max-height: 24rem; overflow: auto; margin: 0; line-height: 1.45; }
.collapsible-doc summary { cursor: pointer; color: var(--ink-soft); font-size: 0.88rem; font-weight: 500; margin-bottom: 0.35rem; }
.collapsible-doc { margin-bottom: 0.75rem; }
.tab-bar { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.75rem; }
.tab-btn { background: var(--panel-2); border: 1px solid var(--border); color: var(--ink-soft); padding: 0.3rem 0.6rem; border-radius: 6px; cursor: pointer; font-size: 0.75rem; }
.tab-btn.active { background: var(--raised); border-color: var(--line-2); color: var(--ink); }
.tab-panel { display: none; }
.tab-panel.active { display: block; }
.badge-done { background: var(--raised); color: var(--ok); border-color: #2c3e30; }
.badge-working { border-color: #2c3a44; color: #bfe3f0; background: #141b20; }
.commit-cell { font-size: 0.75rem; max-width: 14rem; }
.commit-line { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; margin: 0.15rem 0; }
.commit-msg-text { color: var(--muted); flex: 1 1 8rem; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.order-badge { display: inline-block; font-size: 0.72rem; font-weight: 600; color: var(--ink-soft); background: var(--raised); border: 1px solid var(--line-2); border-radius: 4px; padding: 0.1rem 0.35rem; margin-right: 0.35rem; vertical-align: middle; }
.order-columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem; }
.order-column-head { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.order-column-head h3 { font-size: 0.88rem; margin: 0; font-weight: 600; color: var(--ink-soft); }
.order-list { list-style: none; padding: 0; margin: 0; }
.order-item { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; padding: 0.5rem 0; border-bottom: 1px solid var(--border); cursor: pointer; border-radius: 4px; }
.order-item:hover { background: var(--panel-2); }
.order-num { font-weight: 700; color: var(--ink-soft); min-width: 1.5rem; font-size: 0.88rem; }
.order-slug { flex: 1 1 8rem; min-width: 0; }
.order-hint { font-size: 0.78rem; margin: 0.5rem 0 0; }
.order-unlisted { font-size: 0.75rem; margin: 0.35rem 0 0; }
.order-badge-approved { border-color: #2c3e30; color: var(--ok); }
.order-badge-draft { border-color: #3a3322; color: var(--warn); }
.order-badge-single { border-color: var(--line-2); color: var(--ink-soft); }
.order-badge-unset { border-color: var(--border); color: var(--muted); }
.work-card-name-row { display: flex; align-items: center; gap: 0.25rem; min-width: 0; flex: 1; }
.work-card-name-row .work-card-name { flex: 1; min-width: 0; }
.work-card-task.working-now { color: var(--ink); }
.in-progress-list-root { margin-top: 0.5rem; }
.in-progress-list { display: flex; flex-direction: column; gap: 0.5rem; }
.in-progress-item { background: var(--panel-2); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.in-progress-item summary { display: flex; flex-wrap: wrap; align-items: center; gap: 0.45rem 0.85rem; padding: 0.75rem 1rem; cursor: pointer; list-style: none; }
.in-progress-item summary::-webkit-details-marker { display: none; }
.in-progress-item summary::before { content: '▸'; color: var(--muted); font-size: 0.75rem; transition: transform 0.15s; flex-shrink: 0; margin-right: 0.15rem; }
.in-progress-item[open] summary::before { transform: rotate(90deg); }
.in-progress-name { font-weight: 600; font-size: 0.95rem; }
.in-progress-meta { font-size: 0.78rem; color: var(--muted); }
.in-progress-task { font-size: 0.78rem; flex: 1 1 100%; margin-left: 1.1rem; }
.in-progress-body { padding: 0 1rem 1rem; border-top: 1px solid var(--border); }
.in-progress-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.75rem 0 0.5rem; align-items: center; }
.in-progress-empty { text-align: center; padding: 1.25rem 1rem; border: 1px dashed var(--border); border-radius: 10px; margin: 0; }
.guide-body { margin-top: 0.85rem; padding-top: 0.85rem; border-top: 1px solid var(--border); }
.guide>summary{cursor:pointer;font-weight:640;list-style:none;display:flex;align-items:center;gap:9px}
.guide>summary::-webkit-details-marker{display:none}
.guide>summary::before{content:"\\25B8";color:var(--muted);font-size:12px;transition:transform .15s}
.guide[open]>summary::before{transform:rotate(90deg)}
.guide-hint{margin-left:8px;font-weight:400;font-size:12px}
.cmd-list{margin:10px 0 4px}
.cmd{display:flex;align-items:center;gap:12px;padding:9px 0;border-top:1px solid var(--border)}
.cmd:first-child{border-top:none}
.cmd code{background:#0c0c0e;border:1px solid var(--line-2);border-radius:6px;padding:4px 9px;min-width:118px;text-align:center;color:var(--ink)}
.cmd .desc{flex:1;color:var(--ink-soft);font-size:13px}
.copy-cmd{font:inherit;font-size:11.5px;font-weight:600;border:1px solid var(--line-2);background:transparent;color:var(--ink-soft);border-radius:6px;padding:4px 10px;cursor:pointer}
.copy-cmd:hover{color:var(--ink)}
.copy-cmd.done{background:var(--accent);color:#161616;border-color:var(--accent)}
.guide-section { margin-bottom: 1.25rem; }
.guide-section:last-child { margin-bottom: 0; }
.guide-section h3 { font-size: 0.92rem; margin: 0 0 0.5rem; font-weight: 600; color: var(--ink-soft); }
.guide-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; margin: 0.35rem 0 0.5rem; }
.guide-table th, .guide-table td { border-bottom: 1px solid var(--border); padding: 0.45rem 0.5rem; text-align: left; vertical-align: top; }
.guide-table th { color: var(--muted); font-weight: 500; font-size: 0.75rem; }
.guide-table code { font-size: 0.78rem; }
.guide-steps, .guide-list { margin: 0.35rem 0 0.5rem; padding-left: 1.25rem; font-size: 0.84rem; color: var(--ink-soft); }
.guide-steps li, .guide-list li { margin-bottom: 0.35rem; }
.guide-note { font-size: 0.8rem; margin: 0.35rem 0 0; }
.kit-version-strip { display: flex; flex-wrap: wrap; align-items: center; gap: 0.65rem; font-size: 0.84rem; margin-bottom: 1rem; padding: 0.65rem 0.85rem; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; }
.kit-version-strip.update-available { border-color: #3a3322; background: var(--panel); }
.kit-version-badge { font-weight: 600; color: var(--ink); }
.kit-update-hint { color: var(--warn); font-size: 0.82rem; flex: 1 1 12rem; }
.kit-update-hint code { font-size: 0.78rem; }
.kit-upgrade-btn { font-size: 0.82rem; padding: 0.35rem 0.75rem; white-space: nowrap; }
.kit-upgrade-msg { font-size: 0.8rem; color: var(--muted); }
.view{display:none}.view.active{display:block}
.back-btn{display:inline-flex;align-items:center;gap:7px;margin-bottom:22px;color:var(--ink-soft)}
.back-btn:hover{color:var(--ink)}
.fp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:4px}
.fp-head h3{font-size:24px;font-weight:680;margin:0}
.detail-section{margin:18px 0}
.detail-section h4{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:0 0 10px}
${CONTROL_PANEL_CSS}
${WORKFLOW_PANEL_CSS}
@media (max-width: 720px) {
  .work-grid { grid-template-columns: 1fr; }
  .order-columns { grid-template-columns: 1fr; }
}
`;

export const DASHBOARD_CLIENT_JS = `
(function () {
  const items = window.MC_ITEMS || [];
  const workGrid = document.getElementById("mc-work-grid");
  const viewDashboard = document.getElementById("view-dashboard");
  const viewFeature = document.getElementById("view-feature");
  const detailTitle = document.getElementById("detail-title");
  const detailMeta = document.getElementById("detail-meta");
  const detailTasks = document.getElementById("detail-tasks");
  const detailWireframes = document.getElementById("detail-wireframes");
  const detailScreenshots = document.getElementById("detail-screenshots");
  const detailWireframesSection = document.getElementById("detail-wireframes-section");
  const detailPickup = document.getElementById("detail-pickup");
  const detailSteps = document.getElementById("detail-steps");
  const detailBraindump = document.getElementById("detail-braindump");
  const detailSpec = document.getElementById("detail-spec");
  const detailExplore = document.getElementById("detail-explore");
  const detailSkillFindings = document.getElementById("detail-skill-findings");
  const detailPhases = document.getElementById("detail-phases");
  const detailJournal = document.getElementById("detail-journal");
  const detailLayoutDoc = document.getElementById("detail-layout-doc");
  function setView(which){
    viewDashboard.classList.toggle("active", which === "dashboard");
    viewFeature.classList.toggle("active", which === "feature");
    window.scrollTo(0,0);
  }
  const strip = document.getElementById("in-progress-strip");
  const searchInput = document.getElementById("filter-search");
  const typeFilter = document.getElementById("filter-type");
  const statusFilter = document.getElementById("filter-status");
  const sortFilter = document.getElementById("filter-sort");
  let sortKey = window.MC_DEFAULT_SORT || "lastUpdated";
  let sortDir = sortKey === "order" || sortKey === "id" ? 1 : -1;
  let selectedId = null;

  function stageClass(key) {
    return "badge badge-" + (key || "braindump");
  }

  function esc(s) {
    return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
  }

  function escSrcdoc(html) {
    return String(html || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");
  }

  function renderDocBlock(content, title) {
    if (!content || !String(content).trim()) return '<p class="muted">Not available yet.</p>';
    const t = title ? '<div class="doc-title">' + esc(title) + '</div>' : '';
    return '<div class="doc-wrap">' + t + '<pre class="doc-block">' + esc(content) + '</pre></div>';
  }

  function renderStepTimeline(steps) {
    if (!steps || !steps.length) return '<p class="muted">No pipeline steps recorded.</p>';
    return '<ul class="step-timeline">' + steps.map((s) =>
      '<li class="step-item step-' + esc(s.status) + '">' +
        '<span class="step-dot"></span>' +
        '<div class="step-body">' +
          '<div class="step-label">' + esc(s.label) + ' <span class="badge">' + esc(s.status) + '</span></div>' +
          (s.completedAt ? '<div class="step-meta">Completed ' + esc(s.completedAt) + '</div>' : '') +
          (s.journalFile ? '<div class="step-meta">Journal: ' + esc(s.journalFile) + '</div>' : '') +
        '</div></li>'
    ).join('') + '</ul>';
  }

  function renderResearchPages(pages, emptyMsg) {
    if (!pages || !pages.length) return '<p class="muted">' + esc(emptyMsg) + '</p>';
    return '<div class="visual-grid">' + pages.map((p) => {
      const html = p.html || p.content || '';
      if (p.format === 'html' || (html && html.includes('<!DOCTYPE'))) {
        return '<figure class="wireframe-card research-card">' +
          '<iframe srcdoc="' + escSrcdoc(html) + '" title="' + esc(p.label || p.file) + '" loading="lazy"></iframe>' +
          '<figcaption>' + esc(p.label || p.file) + (p.source ? ' · ' + esc(p.source) : '') + '</figcaption>' +
        '</figure>';
      }
      return '<details class="collapsible-doc">' +
        '<summary>' + esc(p.label || p.file) + '</summary>' +
        renderDocBlock(html) +
      '</details>';
    }).join('') + '</div>';
  }

  function renderCollapsibleDocs(docs, emptyMsg) {
    if (!docs || !docs.length) return '<p class="muted">' + esc(emptyMsg) + '</p>';
    return docs.map((d) =>
      '<details class="collapsible-doc">' +
        '<summary>' + esc(d.label || d.file) + (d.source ? ' <span class="muted">(' + esc(d.source) + ')</span>' : '') + '</summary>' +
        renderDocBlock(d.content) +
      '</details>'
    ).join('');
  }

  function activeTaskLabel(i) {
    if (i.hasWorkingTask && i.workingTaskId) {
      return '<span class="badge badge-working">Working now</span> <code>' + esc(i.workingTaskId) + "</code>" +
        (i.workingTaskTitle ? " · " + esc(i.workingTaskTitle) : "");
    }
    if (i.currentTaskId !== "—") {
      return '<span class="muted">Up next:</span> <code>' + esc(i.currentTaskId) + "</code>" +
        (i.currentTaskTitle ? " · " + esc(i.currentTaskTitle) : "");
    }
    if (i.nextCommand) return '<span class="muted"><code>' + esc(i.nextCommand) + "</code></span>";
    return '<span class="muted">—</span>';
  }

  function cardTaskLine(i) {
    if (i.hasWorkingTask && i.workingTaskId) {
      return '<p class="work-card-task working-now"><span class="badge badge-working">Working now</span> <code>' +
        esc(i.workingTaskId) + "</code>" + (i.workingTaskTitle ? " · " + esc(i.workingTaskTitle) : "") + "</p>";
    }
    if (i.currentTaskId !== "—") {
      return '<p class="work-card-task"><span class="muted">Up next:</span> <code>' + esc(i.currentTaskId) + "</code>" +
        (i.currentTaskTitle ? " · " + esc(i.currentTaskTitle) : "") + "</p>";
    }
    return "";
  }

  function renderCommitCell(t) {
    if (t.status !== "done" || !t.commit) return '<span class="muted">—</span>';
    const hash = esc(t.commit);
    const short = esc(t.commitShort || t.commit.slice(0, 7));
    let html = '<div class="commit-line"><code>' + short + '</code>' +
      '<button type="button" class="btn btn-sm copy-value" data-copy="' + hash + '">Copy hash</button></div>';
    if (t.commitMessage) {
      const msg = esc(t.commitMessage);
      html += '<div class="commit-line"><span class="commit-msg-text" title="' + msg + '">' + msg + '</span>' +
        '<button type="button" class="btn btn-sm copy-value" data-copy="' + msg + '">Copy message</button></div>';
    }
    return html;
  }

  function renderTasksTable(tasks) {
    return '<table class="task-table"><thead><tr><th>ID</th><th>Task</th><th>Status</th><th>Updated</th><th>Commit</th></tr></thead><tbody>' +
      tasks.map((t) =>
        '<tr class="task-' + esc(t.status) + '"><td><code>' + esc(t.id) + '</code></td><td>' + esc(t.title) + '</td><td>' +
        (t.status === "in-progress" ? '<span class="badge badge-working">Working now</span>' : esc(t.status)) +
        '</td><td class="muted">' + esc(t.updatedAt || "—") + '</td><td class="commit-cell">' + renderCommitCell(t) + '</td></tr>'
      ).join("") + "</tbody></table>";
  }

  function copyText(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      const t = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(() => { btn.textContent = t; }, 1500);
    });
  }

  function renderInProgressList() {
    const building = items
      .filter((i) => i.stageKey === "build")
      .sort((a, b) => {
        const ao = a.order ?? 999;
        const bo = b.order ?? 999;
        if (ao !== bo) return ao - bo;
        return (b.lastUpdated || "").localeCompare(a.lastUpdated || "");
      });
    if (!building.length) {
      strip.innerHTML = '<p class="in-progress-empty muted">Nothing building right now — pick a card in All work to continue earlier pipeline stages.</p>';
      return;
    }
    strip.innerHTML = '<div class="in-progress-list">' + building.map((i) => {
      const prog = i.progress.total
        ? i.progress.done + "/" + i.progress.total + " · " + i.progress.pct + "%"
        : "";
      let taskHint = "";
      if (i.hasWorkingTask && i.workingTaskId) {
        taskHint = '<span class="badge badge-working">Working now</span> <code>' + esc(i.workingTaskId) + "</code>" +
          (i.workingTaskTitle ? " · " + esc(i.workingTaskTitle) : "");
      } else if (i.currentTaskId !== "—") {
        taskHint = '<span class="muted">Up next:</span> <code>' + esc(i.currentTaskId) + "</code>" +
          (i.currentTaskTitle ? " · " + esc(i.currentTaskTitle) : "");
      }
      const tasksHtml = i.tasks.length
        ? renderTasksTable(i.tasks)
        : '<p class="muted">No build tasks yet.</p>';
      return '<details class="in-progress-item" data-id="' + esc(i.id) + '">' +
        "<summary>" +
          (i.order != null ? '<span class="order-badge">#' + i.order + "</span>" : "") +
          '<span class="in-progress-name">' + esc(i.id) + "</span>" +
          '<span class="in-progress-meta">' + esc(i.type) + (prog ? " · " + prog : "") + "</span>" +
          (taskHint ? '<span class="in-progress-task">' + taskHint + "</span>" : "") +
        "</summary>" +
        '<div class="in-progress-body">' +
          '<div class="in-progress-actions">' +
            '<button type="button" class="btn btn-sm btn-primary copy-pickup" data-id="' + esc(i.id) + '">Copy pickup prompt</button>' +
            '<button type="button" class="btn btn-sm drill-btn" data-id="' + esc(i.id) + '">Open full detail</button>' +
          "</div>" +
          tasksHtml +
        "</div>" +
      "</details>";
    }).join("") + "</div>";
  }

  function filteredItems() {
    const q = (searchInput.value || "").trim().toLowerCase();
    const type = typeFilter.value;
    const st = statusFilter.value;
    return items.filter((i) => {
      if (type === "feature" && i.workstream !== "feature") return false;
      if (type === "tech-stack" && i.workstream !== "tech-stack") return false;
      if (st === "in-progress" && !i.inProgress) return false;
      if (st !== "all" && st !== "in-progress" && i.stageKey !== st) return false;
      if (q && !i.id.toLowerCase().includes(q) && !i.stage.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function sortedItems(list) {
    const copy = [...list];
    copy.sort((a, b) => {
      let va, vb;
      if (sortKey === "id") { va = a.id; vb = b.id; }
      else if (sortKey === "type") { va = a.type; vb = b.type; }
      else if (sortKey === "stage") { va = a.stage; vb = b.stage; }
      else if (sortKey === "progress") { va = a.progress.pct; vb = b.progress.pct; }
      else if (sortKey === "lastUpdated") { va = a.lastUpdated || ""; vb = b.lastUpdated || ""; }
      else if (sortKey === "currentTask") { va = a.currentTaskId; vb = b.currentTaskId; }
      else { va = a.order ?? 999; vb = b.order ?? 999; }
      if (va < vb) return -1 * sortDir;
      if (va > vb) return 1 * sortDir;
      return 0;
    });
    return copy;
  }

  function renderWorkGrid() {
    const list = sortedItems(filteredItems());
    renderInProgressList();
    if (!list.length) {
      workGrid.innerHTML = '<div class="empty-cards">No items match filters.</div>';
      return;
    }
    workGrid.innerHTML = list.map((i) => {
      const prog = i.progress.total
        ? i.progress.done + "/" + i.progress.total + " (" + i.progress.pct + "%)"
        : "—";
      const fillClass = i.workstream === "tech-stack" ? " progress-fill-tech" : "";
      const bar = i.progress.total
        ? '<div class="progress-bar"><div class="progress-fill' + fillClass + '" style="width:' + i.progress.pct + '%"></div></div>'
        : "";
      const taskLine = cardTaskLine(i);
      return '<article class="work-card' + (selectedId === i.id ? " selected" : "") + '" data-id="' + esc(i.id) + '">' +
        '<div class="work-card-header">' +
          '<div class="work-card-name-row">' +
            (i.order != null ? '<span class="order-badge">#' + i.order + '</span>' : '') +
            '<h3 class="work-card-name">' + esc(i.id) + '</h3>' +
          '</div>' +
          '<span class="work-card-type">' + esc(i.type) + '</span>' +
        '</div>' +
        '<p class="work-card-meta"><span class="' + stageClass(i.stageKey) + '">' + esc(i.stage) + '</span> · Updated ' + esc(i.lastUpdatedDisplay) + '</p>' +
        '<div class="progress-cell">' + prog + bar + '</div>' +
        taskLine +
        '<div class="work-card-actions">' +
          '<button type="button" class="btn btn-sm copy-pickup" data-id="' + esc(i.id) + '">Pickup</button>' +
          '<button type="button" class="btn btn-sm btn-primary drill-btn" data-id="' + esc(i.id) + '">Open</button>' +
        '</div>' +
      '</article>';
    }).join("");
  }

  function renderWireframes(i) {
    if (!i.wireframes || !i.wireframes.length) {
      if (i.workstream === "feature" && i.stageKey !== "done" && i.pipelineStage !== "done") {
        return '<p class="muted">No UI mockups yet — mock stage will produce wireframes here.</p>';
      }
      return '<p class="muted">No wireframes for this item.</p>';
    }
    return '<div class="visual-grid">' + i.wireframes.map((w) =>
      '<figure class="wireframe-card">' +
        '<iframe srcdoc="' + escSrcdoc(w.html) + '" title="' + esc(w.label) + ' wireframe" loading="lazy"></iframe>' +
        '<figcaption>' + esc(w.label) + '</figcaption>' +
      '</figure>'
    ).join("") + '</div>';
  }

  function renderScreenshots(i) {
    if (!i.screenshots || !i.screenshots.length) {
      return '<p class="muted">No e2e screenshots yet — they appear here after phase-end e2e runs.</p>';
    }
    return '<div class="visual-grid">' + i.screenshots.map((s) =>
      '<figure class="shot-card">' +
        '<img src="' + esc(s.dataUrl) + '" alt="' + esc(s.taskId) + '" loading="lazy" />' +
        '<figcaption><code>' + esc(s.taskId) + '</code>' + (s.taskTitle ? ' — ' + esc(s.taskTitle) : '') + '</figcaption>' +
      '</figure>'
    ).join("") + '</div>';
  }

  function openDetail(id) {
    const i = items.find((x) => x.id === id);
    if (!i) return;
    selectedId = id;
    detailTitle.textContent = i.id + " (" + i.type + ")";
    detailMeta.innerHTML = '<span class="' + stageClass(i.stageKey) + '">' + esc(i.stage) + '</span> · Pipeline: <code>' + esc(i.pipelineStage || i.stageKey) + '</code> · Last updated ' + esc(i.lastUpdatedDisplay) +
      (i.hasWorkingTask ? ' · <span class="badge badge-working">Working now</span> <code>' + esc(i.workingTaskId) + '</code>' + (i.workingTaskTitle ? ' — ' + esc(i.workingTaskTitle) : '') : '') +
      (!i.hasWorkingTask && i.nextCommand ? ' · Next: <code>' + esc(i.nextCommand) + '</code>' : '');
    detailPickup.textContent = i.pickupPrompt;
    if (detailSteps) detailSteps.innerHTML = renderStepTimeline(i.stepTimeline);
    if (detailBraindump) detailBraindump.innerHTML = renderDocBlock(i.braindump, "Braindump");
    if (detailSpec) detailSpec.innerHTML = renderDocBlock(i.spec, "PRD / Spec");
    if (detailExplore) detailExplore.innerHTML = renderResearchPages(i.exploreDocs, "No exploration findings yet.");
    if (detailSkillFindings) detailSkillFindings.innerHTML = renderResearchPages(i.skillFindings, "No skill findings yet — research, strategy, and interaction HTML outputs appear here.");
    if (detailPhases) detailPhases.innerHTML = renderCollapsibleDocs(i.phaseDocs, "No implementation plans yet.");
    if (detailJournal) detailJournal.innerHTML = renderCollapsibleDocs(i.journalEntries, "No journal entries yet — subagents document here when tasks complete.");
    if (detailLayoutDoc) detailLayoutDoc.innerHTML = renderDocBlock(i.layoutDoc, "Layout notes");
    if (detailWireframesSection) {
      detailWireframesSection.style.display = i.workstream === "tech-stack" ? "none" : "";
    }
    detailWireframes.innerHTML = renderWireframes(i);
    if (!i.tasks.length) {
      detailTasks.innerHTML = '<p class="muted">No build tasks yet.</p>';
    } else {
      detailTasks.innerHTML = renderTasksTable(i.tasks);
    }
    detailScreenshots.innerHTML = renderScreenshots(i);
    setView("feature");
    if (location.hash !== "#feature/" + encodeURIComponent(id)) {
      history.pushState({ featureId: id }, "", "#feature/" + encodeURIComponent(id));
    }
  }

  function goDashboard(){
    selectedId = null;
    setView("dashboard");
    if (location.hash) history.replaceState({}, "", location.pathname + location.search);
    renderWorkGrid();
  }

  function copyPickup(id) {
    const i = items.find((x) => x.id === id);
    if (!i) return;
    navigator.clipboard.writeText(i.pickupPrompt).then(() => {
      document.querySelectorAll('.copy-pickup[data-id="' + id + '"]').forEach((b) => {
        const t = b.textContent;
        b.textContent = "Copied";
        setTimeout(() => { b.textContent = t; }, 1500);
      });
    });
  }

  sortFilter.addEventListener("change", () => {
    sortKey = sortFilter.value;
    sortDir = sortKey === "id" ? 1 : -1;
    renderWorkGrid();
  });

  [searchInput, typeFilter, statusFilter].forEach((el) => el.addEventListener("input", renderWorkGrid));
  [typeFilter, statusFilter].forEach((el) => el.addEventListener("change", renderWorkGrid));

  workGrid.addEventListener("click", (e) => {
    const btn = e.target.closest(".copy-pickup, .drill-btn");
    if (btn) {
      e.stopPropagation();
      if (btn.classList.contains("copy-pickup")) copyPickup(btn.dataset.id);
      else openDetail(btn.dataset.id);
      return;
    }
    const card = e.target.closest(".work-card[data-id]");
    if (card) openDetail(card.dataset.id);
  });

  strip.addEventListener("click", (e) => {
    const btn = e.target.closest(".copy-pickup, .drill-btn");
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      if (btn.classList.contains("copy-pickup")) copyPickup(btn.dataset.id);
      else openDetail(btn.dataset.id);
    }
  });

  const orderPanel = document.getElementById("build-order-panel");
  if (orderPanel) {
    orderPanel.addEventListener("click", (e) => {
      const item = e.target.closest(".order-item[data-id]");
      if (item) openDetail(item.dataset.id);
    });
    orderPanel.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const item = e.target.closest(".order-item[data-id]");
      if (item) { e.preventDefault(); openDetail(item.dataset.id); }
    });
  }

  if (sortFilter && window.MC_DEFAULT_SORT) sortFilter.value = window.MC_DEFAULT_SORT;

  document.getElementById("detail-copy-pickup").addEventListener("click", () => {
    if (selectedId) copyPickup(selectedId);
  });
  document.getElementById("detail-back").addEventListener("click", goDashboard);
  viewFeature.addEventListener("click", (e) => {
    const copyBtn = e.target.closest(".copy-value");
    if (copyBtn && copyBtn.dataset.copy) {
      e.stopPropagation();
      copyText(copyBtn.dataset.copy, copyBtn);
    }
  });

  const handoffBtn = document.getElementById("copy-handoff");
  if (handoffBtn) {
    handoffBtn.addEventListener("click", () => {
      const text = document.getElementById("handoff-text").textContent;
      navigator.clipboard.writeText("Continue from this handoff:\\n\\n" + text);
      handoffBtn.textContent = "Copied";
      setTimeout(() => { handoffBtn.textContent = "Copy full handoff"; }, 1500);
    });
  }

  function copyCmd(btn){
    var text = btn.getAttribute("data-cmd");
    function ok(){ var t=btn.textContent; btn.textContent="Copied ✓"; btn.classList.add("done"); setTimeout(function(){btn.textContent=t;btn.classList.remove("done");},1200); }
    function fallback(){
      var code = btn.parentNode.querySelector("code");
      if(code){ var r=document.createRange(); r.selectNodeContents(code); var s=window.getSelection(); s.removeAllRanges(); s.addRange(r); }
      try{ document.execCommand("copy"); ok(); }catch(e){ btn.textContent="Press ⌘/Ctrl+C"; }
    }
    if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(ok).catch(fallback); } else { fallback(); }
  }
  document.addEventListener("click", function(e){ var b=e.target.closest && e.target.closest(".copy-cmd"); if(b) copyCmd(b); });

  renderWorkGrid();
  function routeFromHash(){
    var m = (location.hash || "").match(/^#feature\\/(.+)$/);
    if (m) { var fid = decodeURIComponent(m[1]); if (items.some(function(x){return x.id===fid;})) { openDetail(fid); return; } }
    setView("dashboard");
  }
  window.addEventListener("popstate", routeFromHash);
  routeFromHash();
})();
`;

export function buildDashboardHtml({
  generatedAt,
  handoff,
  stack,
  global,
  rows,
  isMock = false,
  orderSummary = null,
  defaultSort = "lastUpdated",
  kitVersion = null,
  controls = null,
  gate = null,
  nextPick = null,
  serveMode = false,
}) {
  const buildingCount = rows.filter((r) => r.stageKey === "build").length;
  const initNotice =
    stack.techStackStatus !== "established"
      ? `<p class="notice">Tech stack not established — run <code>/mc-init</code> for an existing codebase, or <code>/mc-start</code> for a brand-new product.</p>`
      : "";

  const versionStrip = renderKitVersionStrip(kitVersion, escapeHtml);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mission Control${isMock ? " — Preview" : ""}</title>
  <style>${DASHBOARD_CSS}</style>
</head>
<body>
  <div id="view-dashboard" class="view active">
  <h1>Mission Control v4</h1>
  <p class="subtitle">Orchestrator-driven pipeline — Project START and Add Feature. Drill into a card for spec, plans, mocks, journal, and tasks.</p>
  <p class="top-meta">${isMock ? "<strong>Preview mock</strong> · " : ""}Generated ${escapeHtml(generatedAt)} · All content embedded — open this file directly, no external links required.</p>

  ${versionStrip}

  ${controls ? renderControlPanel({ controls, gate: gate ?? {}, nextPick: nextPick ?? {}, serveMode }) : ""}

  ${controls ? renderWorkflowPanel({ controls, serveMode }) : ""}

  ${initNotice}

  <div class="panel">
    <h2>In progress</h2>
    <p class="muted">${buildingCount} item${buildingCount === 1 ? "" : "s"} building · expand for tasks, commits, and pickup prompt</p>
    <div class="stack-line"><strong>Stack:</strong> ${escapeHtml(stack.summary)} · ${escapeHtml(stack.projectMode)}</div>
    <div id="in-progress-strip" class="in-progress-list-root"></div>
  </div>

  <div class="panel">
    <h2>Build order</h2>
    <p class="muted">Recommended sequence from <code>/mc-portfolio</code> dependency analysis — build top to bottom.</p>
    <div id="build-order-panel">${orderSummary ? renderBuildOrderPanel(orderSummary) : '<p class="muted">Regenerate dashboard to show build order.</p>'}</div>
  </div>

  <details class="handoff-collapsed panel">
    <summary>Full session handoff (all features)</summary>
    <pre class="handoff-pre" id="handoff-text">${escapeHtml(handoff || "No handoff yet.")}</pre>
    <button type="button" class="btn" id="copy-handoff">Copy full handoff</button>
  </details>

  <div class="panel">
    <h2>All work</h2>
    <div class="toolbar">
      <label>Search <input type="search" id="filter-search" placeholder="Feature name…" /></label>
      <label>Type
        <select id="filter-type">
          <option value="all">All</option>
          <option value="feature">Features</option>
          <option value="tech-stack">Tech stack</option>
        </select>
      </label>
      <label>Status
        <select id="filter-status">
          <option value="all">All</option>
          <option value="in-progress">In progress only</option>
          <option value="build">Building</option>
          <option value="plan">Plan</option>
          <option value="layout">Layout</option>
          <option value="spec">Spec</option>
          <option value="done">Complete</option>
        </select>
      </label>
      <label>Sort
        <select id="filter-sort">
          <option value="lastUpdated">Last updated</option>
          <option value="id">Name</option>
          <option value="stage">Status</option>
          <option value="progress">Progress</option>
          <option value="currentTask">Current task</option>
          <option value="order">Build order</option>
        </select>
      </label>
    </div>
    <div id="mc-work-grid" class="work-grid"></div>
  </div>

  ${renderUserGuideDisclosure()}
  </div>

  <div id="view-feature" class="view">
    <button type="button" class="btn back-btn" id="detail-back">‹ Back to dashboard</button>
    <div class="fp-head">
      <h3 id="detail-title">—</h3>
      <button type="button" class="btn btn-primary" id="detail-copy-pickup">Copy pickup prompt</button>
    </div>
    <p id="detail-meta" class="muted"></p>
    <p class="muted">Paste into the <strong>Orchestrator chat</strong> (same session if active, or <code>/mc</code> to resume):</p>
    <pre class="pickup-pre" id="detail-pickup"></pre>
    <div class="detail-section"><h4>Pipeline steps</h4><div id="detail-steps"></div></div>
    <div class="detail-section"><h4>Braindump</h4><div id="detail-braindump"></div></div>
    <div class="detail-section"><h4>PRD / Spec</h4><div id="detail-spec"></div></div>
    <div class="detail-section"><h4>Exploration findings</h4><div id="detail-explore"></div></div>
    <div class="detail-section"><h4>Skill findings</h4><p class="muted">Research, strategy, and interaction HTML layouts — review before build when decision review is on.</p><div id="detail-skill-findings"></div></div>
    <div class="detail-section" id="detail-wireframes-section"><h4>UI mockups</h4><div id="detail-wireframes"></div></div>
    <div class="detail-section"><h4>Layout notes</h4><div id="detail-layout-doc"></div></div>
    <div class="detail-section"><h4>Implementation plans</h4><div id="detail-phases"></div></div>
    <div class="detail-section"><h4>Build tasks</h4><div id="detail-tasks"></div></div>
    <div class="detail-section"><h4>Subagent journal</h4><div id="detail-journal"></div></div>
    <div class="detail-section" id="detail-screenshots-section"><h4>E2E screenshots</h4><div id="detail-screenshots"></div></div>
  </div>

  <p class="footer">${isMock ? "Preview file — " : ""}Regenerate: <code>node docs/superpowers/control/scripts/generate-dashboard.mjs</code> · Control panel: <code>node docs/superpowers/control/scripts/dashboard-server.mjs</code></p>

  <script>window.MC_ITEMS = ${safeJsonForScriptEmbed(rows)};window.MC_DEFAULT_SORT = ${safeJsonForScriptEmbed(defaultSort)};</script>
  <script>${DASHBOARD_CLIENT_JS}</script>
  <script>${CONTROL_PANEL_CLIENT_JS}</script>
  <script>${WORKFLOW_PANEL_CLIENT_JS}</script>
  <script>${KIT_VERSION_CLIENT_JS}</script>
</body>
</html>`;
}
