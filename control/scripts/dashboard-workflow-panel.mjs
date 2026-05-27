import { escapeHtml } from './dashboard-helpers.mjs';
import { BUILD_MODES } from '../lib/workflow-controls.mjs';
import { PIPELINE_SCOPES, DECISION_REVIEW_MODES } from '../lib/session-intent.mjs';

export const WORKFLOW_PANEL_CSS = `
.workflow-panel { border-color: var(--line-2); margin-top: 0; }
.control-field { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.84rem; }
.control-field label { color: var(--muted); font-size: 0.78rem; }
.control-field select { background: var(--panel-2); border: 1px solid var(--border); color: var(--ink); border-radius: 6px; padding: 0.35rem 0.55rem; font-size: 0.82rem; }
.workflow-hint { font-size: 0.78rem; color: var(--muted); margin: 0.5rem 0 0; }
`;

export function renderWorkflowPanel({ controls, serveMode = false }) {
  const mode = controls.buildWorkflow?.mode ?? 'sdd+tdd';
  const review = controls.buildWorkflow?.reviewChain ?? 'full';
  const plan = controls.planWorkflow?.mode ?? 'subagent-driven';
  const pipelineScope = controls.sessionIntent?.pipelineScope ?? 'full-pipeline';
  const decisionReview = controls.sessionIntent?.decisionReview ?? 'review-first';
  const reviewDisabled = mode === 'tdd-lite' || !serveMode;

  const buildOptions = Object.entries(BUILD_MODES)
    .map(([id, meta]) => `<option value="${escapeHtml(id)}"${id === mode ? ' selected' : ''}>${escapeHtml(meta.label)}</option>`)
    .join('');

  const scopeOptions = Object.entries(PIPELINE_SCOPES)
    .map(([id, meta]) => `<option value="${escapeHtml(id)}"${id === pipelineScope ? ' selected' : ''}>${escapeHtml(meta.label)}</option>`)
    .join('');

  const decisionOptions = Object.entries(DECISION_REVIEW_MODES)
    .map(([id, meta]) => `<option value="${escapeHtml(id)}"${id === decisionReview ? ' selected' : ''}>${escapeHtml(meta.label)}</option>`)
    .join('');

  return `
  <div class="panel workflow-panel" id="workflow-control-panel">
    <h2>Workflow controls</h2>
    <p class="muted">Build, plan, and session intent — agents read <code>WORKFLOW-CONTROLS.md</code>, <code>SESSION-INTENT.md</code>, and <code>.mc/orchestrator-controls.json</code>.</p>
    <div class="control-grid">
      <div class="control-field">
        <label for="ctl-pipeline-scope">Session pipeline scope</label>
        <select id="ctl-pipeline-scope" ${serveMode ? '' : 'disabled'}>${scopeOptions}</select>
      </div>
      <div class="control-field">
        <label for="ctl-decision-review">Decision review</label>
        <select id="ctl-decision-review" ${serveMode ? '' : 'disabled'}>${decisionOptions}</select>
      </div>
      <div class="control-field">
        <label for="ctl-build-mode">Build mode</label>
        <select id="ctl-build-mode" ${serveMode ? '' : 'disabled'}>${buildOptions}</select>
      </div>
      <div class="control-field">
        <label for="ctl-review-chain">Review chain (SDD modes)</label>
        <select id="ctl-review-chain" ${reviewDisabled ? 'disabled' : ''}>
          <option value="full"${review === 'full' ? ' selected' : ''}>Full — spec + quality reviewers</option>
          <option value="spec-only"${review === 'spec-only' ? ' selected' : ''}>Spec reviewer only</option>
          <option value="none"${review === 'none' ? ' selected' : ''}>None — gates only</option>
        </select>
      </div>
      <div class="control-field">
        <label for="ctl-plan-mode">Plan execution</label>
        <select id="ctl-plan-mode" ${serveMode ? '' : 'disabled'}>
          <option value="subagent-driven"${plan === 'subagent-driven' ? ' selected' : ''}>Subagent-driven (same session)</option>
          <option value="executing-plans"${plan === 'executing-plans' ? ' selected' : ''}>Executing-plans (parallel session option)</option>
        </select>
      </div>
    </div>
    <p class="workflow-hint" id="workflow-hint">Default: SDD + TDD with full review chain. Orchestrator confirms session intent at every <code>/mc</code> start.</p>
  </div>`;
}

export const WORKFLOW_PANEL_CLIENT_JS = `
(function () {
  const buildMode = document.getElementById("ctl-build-mode");
  const reviewChain = document.getElementById("ctl-review-chain");
  const hint = document.getElementById("workflow-hint");
  if (!buildMode) return;

  function syncReviewState() {
    if (!reviewChain) return;
    const lite = buildMode.value === "tdd-lite";
    reviewChain.disabled = lite;
    if (lite) reviewChain.value = "none";
    if (hint) {
      hint.textContent = lite
        ? "TDD-lite: one implementer per task with test-driven-development; no reviewer subagents."
        : buildMode.value === "sdd"
          ? "SDD only: subagent-driven-development; BUILD-GATES still require tests."
          : "SDD + TDD: subagent-driven-development + test-driven-development on implementer.";
    }
  }

  buildMode.addEventListener("change", syncReviewState);
  syncReviewState();
})();
`;
