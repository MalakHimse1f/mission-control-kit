import { escapeHtml } from './dashboard-helpers.mjs';

export const CONTROL_PANEL_CSS = `
.control-panel { border-color: #3a4a5a; }
.control-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.75rem 1.25rem; margin-top: 0.5rem; }
.control-toggle { display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.84rem; cursor: pointer; }
.control-toggle input { margin-top: 0.2rem; }
.control-toggle span { line-height: 1.35; }
.control-status { font-size: 0.82rem; margin: 0.65rem 0 0; padding: 0.55rem 0.65rem; background: #0f0f0f; border: 1px solid var(--border); border-radius: 8px; }
.control-status.warn { border-color: #665; color: #cc9; }
.control-status.ok { border-color: #484; color: #9c9; }
.control-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.65rem; align-items: center; }
.control-save-msg { font-size: 0.78rem; color: var(--muted); }
.control-offline { border-color: #844; background: #1a1010; color: #daa; font-size: 0.82rem; padding: 0.55rem 0.65rem; border-radius: 8px; margin-bottom: 0.65rem; }
`;

export function renderControlPanel({ controls, gate, nextPick, serveMode = false }) {
  const offline = serveMode
    ? ''
    : `<div class="control-offline">Control panel saves require the dashboard server. Run <code>node docs/superpowers/control/scripts/dashboard-server.mjs</code> and open <code>http://127.0.0.1:9470/</code></div>`;

  const statusClass = gate.allowed && nextPick.slug ? 'ok' : 'warn';
  const nextLine = nextPick.slug
    ? `Next auto-pick: <strong>#${nextPick.order} ${escapeHtml(nextPick.slug)}</strong>`
    : escapeHtml(nextPick.reason ?? gate.reason ?? 'No eligible feature queued.');

  return `
  <div class="panel control-panel" id="orchestrator-control-panel">
    <h2>Orchestrator controls</h2>
    <p class="muted">Saved to <code>.mc/orchestrator-controls.json</code> — agents read this every <code>/mc</code> session.</p>
    ${offline}
    <div class="control-grid">
      <label class="control-toggle">
        <input type="checkbox" id="ctl-advance" ${controls.advanceToNextFeature ? 'checked' : ''} ${serveMode ? '' : 'disabled'} />
        <span><strong>Advance to next feature</strong> when current build queue item finishes (plan required)</span>
      </label>
      <label class="control-toggle">
        <input type="checkbox" id="ctl-ralph" ${controls.ralphLoop?.enabled ? 'checked' : ''} ${serveMode ? '' : 'disabled'} />
        <span><strong>Ralph loop</strong> — write resume prompt on session end for a fresh orchestrator</span>
      </label>
      <label class="control-toggle">
        <input type="checkbox" id="ctl-portfolio-gate" ${controls.pauseOnPortfolioDraft !== false ? 'checked' : ''} ${serveMode ? '' : 'disabled'} />
        <span><strong>Require approved portfolio</strong> before auto-advance</span>
      </label>
    </div>
    <div class="control-status ${statusClass}" id="ctl-status">${nextLine}</div>
    <div class="control-actions">
      <button type="button" class="btn btn-primary" id="ctl-save" ${serveMode ? '' : 'disabled'}>Save controls</button>
      <span class="control-save-msg" id="ctl-save-msg"></span>
    </div>
  </div>`;
}

export const CONTROL_PANEL_CLIENT_JS = `
(function () {
  const panel = document.getElementById("orchestrator-control-panel");
  if (!panel) return;

  const saveBtn = document.getElementById("ctl-save");
  const saveMsg = document.getElementById("ctl-save-msg");
  const statusEl = document.getElementById("ctl-status");

  function collectPatch() {
    return {
      advanceToNextFeature: document.getElementById("ctl-advance").checked,
      pauseOnPortfolioDraft: document.getElementById("ctl-portfolio-gate").checked,
      ralphLoop: {
        enabled: document.getElementById("ctl-ralph").checked,
        spawnFreshSession: true,
      },
      autoAdvanceScope: "build-only",
      pauseOnClarify: true,
      pauseOnBlocked: true,
    };
  }

  function renderStatus(payload) {
    const gate = payload.gate || {};
    const next = payload.nextPick || {};
    let html = "";
    if (next.slug) {
      html = "Next auto-pick: <strong>#" + next.order + " " + esc(next.slug) + "</strong>";
      statusEl.className = "control-status ok";
    } else {
      html = esc(next.reason || gate.reason || "No eligible feature queued.");
      statusEl.className = "control-status warn";
    }
    statusEl.innerHTML = html;
  }

  async function saveControls() {
    if (!saveBtn || saveBtn.disabled) return;
    saveMsg.textContent = "Saving…";
    try {
      const res = await fetch("/api/orchestrator-controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(collectPatch()),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Save failed");
      renderStatus(data);
      saveMsg.textContent = "Saved " + (data.controls?.updatedAt || "");
      setTimeout(function () { saveMsg.textContent = ""; }, 2500);
    } catch (err) {
      saveMsg.textContent = err.message || "Save failed";
    }
  }

  if (saveBtn && !saveBtn.disabled) {
    saveBtn.addEventListener("click", saveControls);
    fetch("/api/orchestrator-controls")
      .then(function (r) { return r.json(); })
      .then(renderStatus)
      .catch(function () {});
  }
})();
`;
