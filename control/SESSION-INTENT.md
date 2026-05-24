# Session intent

On every `/mc` resume (including pasted pickup prompts), the orchestrator **reviews disk state first**, then uses the structured ask tool to confirm how this session should run.

Saved to **`.mc/orchestrator-controls.json` → `sessionIntent`**. The dashboard **Workflow controls** panel can preset values; the orchestrator still asks at session start unless the user explicitly says to use dashboard defaults.

Also read: `USER-QUESTIONS.md`, `ORCHESTRATOR-CONTROLS.md`.

---

## Fields

| Field | Default | Meaning |
|-------|---------|---------|
| `pipelineScope` | `"full-pipeline"` | How far the pipeline runs this session |
| `decisionReview` | `"review-first"` | Whether to pause for user review after skill findings |

### pipelineScope

| Value | Behavior |
|-------|----------|
| `planning-only` | Run braindump → explore → research → clarify → strategy → interaction → prd → mock → plan. **Stop before build** — do not dispatch implementers. Regenerate dashboard and report. |
| `full-pipeline` | Continuous run through build and validate (existing default). |
| `build-only` | When `phases/*.md`, `tasks[]`, and `specStatus: approved` exist, skip planning stages and dispatch build subagents. |

### decisionReview

| Value | Behavior |
|-------|----------|
| `review-first` | After skill stages (research, strategy, interaction, explore, clarify, prd, mock, plan), summarize **key decisions** in chat and **AskQuestion** before the next dispatch. Findings are always written to disk for dashboard review. |
| `auto-proceed` | Subagents proceed with **default choices** grounded in research findings. Document rationale in journal files. User reviews artifacts in the dashboard **Skill findings** section. |

---

## Session start flow (mandatory on `/mc`)

1. **Read disk** — `state.json`, `HANDOFF.md`, active `status.json`, `.mc/orchestrator-controls.json`, latest journals, skill artifacts (`research.md`, `ux-strategy.md`, `interaction.md`, `explore/*.md`).
2. **Brief the user** — one paragraph: active slug, `pipelineStage`, what's done, what's next, suggested scope from disk.
3. **AskQuestion (Cursor) / AskUserQuestion (Claude)** — pipeline scope. Options depend on state (see `USER-QUESTIONS.md`).
4. **AskQuestion / AskUserQuestion** — decision review mode (unless user already set both via dashboard and says "use dashboard settings").
5. **Merge** answers into `.mc/orchestrator-controls.json` → `sessionIntent`.
6. **Regenerate dashboard** and continue the pipeline per scope.

**One question per tool call.** Wait for each answer.

---

## Pickup prompts

Pickup prompts embed current `sessionIntent` via `buildSessionIntentPromptLines()`. When the user pastes a pickup prompt, the orchestrator still runs the session-start questions — the pasted text is context, not a bypass.

---

## Skill findings on dashboard

Vendor skill outputs must land at known paths so the dashboard can embed them:

| Artifact | Path |
|----------|------|
| UX research | `features/{slug}/research.md` |
| UX strategy | `features/{slug}/ux-strategy.md` |
| Interaction design | `features/{slug}/interaction.md` |
| Codebase exploration | `features/{slug}/explore/*.md` |

The dashboard **Skill findings** section shows these in the feature detail modal.

---

## Stop conditions (planning-only)

When `pipelineScope === "planning-only"` and the active item reaches `pipelineStage: plan` with tasks written:

1. Mark planning complete in journal
2. Update `HANDOFF.md` — "Planning complete; build deferred by session intent"
3. Regenerate dashboard
4. **Stop** — do not dispatch build subagents

If plan stage is not yet done, continue through planning stages only.

---

## Related

| File | Role |
|------|------|
| `lib/session-intent.mjs` | Normalization + pickup prompt lines |
| `lib/orchestrator-controls.mjs` | Defaults + merge |
| `scripts/dashboard-workflow-panel.mjs` | Dashboard presets |
| `USER-QUESTIONS.md` | Ask tool wording |
