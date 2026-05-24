/**
 * Collapsible getting-started guide embedded in dashboard.html.
 * PM-facing — commands, new project, existing project init, feature build flow.
 */
export function renderUserGuideDisclosure() {
  return `<details class="guide-disclosure panel" open>
    <summary>How to use Mission Control</summary>
    <div class="guide-body">
      <section class="guide-section">
        <h3>Commands</h3>
        <table class="guide-table">
          <thead><tr><th>Command</th><th>When to use</th></tr></thead>
          <tbody>
            <tr><td><code>/mc-start &lt;idea&gt;</code></td><td>Brand-new product — market validation, stack, portfolio</td></tr>
            <tr><td><code>/mc-init</code></td><td>Existing codebase — establish tech stack once (required before Add Feature)</td></tr>
            <tr><td><code>/mc-feature &lt;idea + paths&gt;</code></td><td>New capability in an established product — design, PRD, mock, plan, build</td></tr>
            <tr><td><code>/mc</code></td><td>Resume where disk left off (same orchestrator session when possible)</td></tr>
            <tr><td><code>/mc-portfolio</code></td><td>Approve build order when multiple features exist</td></tr>
            <tr><td><code>/mc-handoff</code></td><td>Chat summary before <code>/clear</code> — disk handoff stays authoritative</td></tr>
          </tbody>
        </table>
        <p class="guide-note muted"><code>/mc-braindump</code> is a legacy alias for <code>/mc-feature</code>.</p>
      </section>

      <section class="guide-section">
        <h3>Start a new project</h3>
        <ol class="guide-steps">
          <li>Install Mission Control v4 into the repo (kit <code>install.sh</code>).</li>
          <li>In the orchestrator chat, run <code>/mc-start &lt;describe the product&gt;</code>.</li>
          <li>The orchestrator runs <strong>Project START</strong> continuously: braindump → market validation → competitors → positioning → platforms → stack → portfolio → launch prep.</li>
          <li>Requires the <strong>startup-skill</strong> vendor bundle (installed automatically when possible).</li>
          <li>When Project START reaches <code>done</code>, use <code>/mc-feature</code> for each user-facing capability.</li>
        </ol>
      </section>

      <section class="guide-section">
        <h3>Initialize an existing project</h3>
        <ol class="guide-steps">
          <li>Install Mission Control v4 if not already present.</li>
          <li>Run <code>/mc-init</code> <strong>once</strong> — the orchestrator detects stack, confirms platforms/surfaces, and writes <code>tech-stack/stack.json</code> with <code>techStackStatus: established</code>.</li>
          <li>Platform and layout targets are chosen here only — later stages read <code>stack.json</code>; they do not ask again.</li>
          <li>After init, run <code>/mc-feature &lt;feature + target codebase folder paths&gt;</code> for each new capability.</li>
          <li>If the dashboard shows the init notice below, complete <code>/mc-init</code> before Add Feature.</li>
        </ol>
      </section>

      <section class="guide-section">
        <h3>Build a feature</h3>
        <p>Add Feature runs in <strong>one continuous orchestrator session</strong> — do not start a new chat between stages unless blocked or rotating after several build tasks.</p>
        <ol class="guide-steps">
          <li><strong>Braindump</strong> — capture idea and codebase paths → <code>features/{slug}/braindump.md</code></li>
          <li><strong>Explore</strong> — subagent maps each target repo</li>
          <li><strong>Research &amp; clarify</strong> — design-research + your answers (AskQuestion)</li>
          <li><strong>PRD</strong> — subagent writes <code>spec.md</code> using <strong>prd-generator</strong> skill</li>
          <li><strong>Interaction &amp; mock</strong> — flows and wireframes (UX features)</li>
          <li><strong>Plan</strong> — phased implementation tasks in <code>phases/</code></li>
          <li><strong>Build</strong> — subagent-driven development; BUILD-GATES (lint, test, build) every task</li>
          <li><strong>Validate</strong> — phase e2e and evidence before marking done</li>
        </ol>
        <p class="guide-note">Requires <strong>designer-skills</strong> and <strong>prd-generator</strong> bundles. Tech-only features skip mock/interaction stages.</p>
        <p class="guide-note">To continue later: <code>/mc</code> or open a feature card here and copy its pickup prompt.</p>
      </section>

      <section class="guide-section">
        <h3>Upgrade Mission Control</h3>
        <p>Kit updates refresh orchestrator docs and skills. Your <code>features/</code> specs and journals are <strong>never</strong> overwritten.</p>
        <ul class="guide-list">
          <li><code>/mc-upgrade</code> — safe upgrade in chat</li>
          <li><code>node mission-control-kit/scripts/mc-upgrade.mjs . --check --fetch</code> — compare install stamp to GitHub Releases</li>
          <li><code>--dry-run</code> — preview what would sync</li>
        </ul>
        <p class="guide-note">The dashboard version strip checks <strong>GitHub Releases</strong> via <code>dashboard-server.mjs</code>, or run <code>generate-dashboard.mjs --check-remote</code> to embed a one-off check in static HTML.</p>
      </section>

      <section class="guide-section">
        <h3>Orchestrator controls &amp; ralph loop</h3>
        <p>Run the dashboard server to save unattended-run toggles (agents read <code>.mc/orchestrator-controls.json</code>):</p>
        <ol class="guide-steps">
          <li><code>node docs/superpowers/control/scripts/dashboard-server.mjs</code></li>
          <li>Open <code>http://127.0.0.1:9470/</code></li>
          <li>Enable <strong>Advance to next feature</strong> after <code>/mc-portfolio</code> locks build order</li>
          <li>Optional: enable <strong>Ralph loop</strong> + wire <code>hooks/mc-ralph-on-stop.example.json</code> + run <code>scripts/mc-ralph-loop.sh</code></li>
        </ol>
        <p class="guide-note">Auto-advance is build-queue only (plan must exist). Clarify questions always pause — the agent never guesses.</p>
      </section>

      <section class="guide-section">
        <h3>Resume &amp; mid-build</h3>
        <ul class="guide-list">
          <li><code>/mc</code> — reads <code>state.json</code> and active <code>pipelineStage</code></li>
          <li><code>/mc-build</code> — resume implementation when phase plans exist (v3-style shortcut)</li>
          <li><code>/mc-validate {slug} phase-N</code> — run validation gate after a phase completes</li>
        </ul>
      </section>
    </div>
  </details>`;
}
