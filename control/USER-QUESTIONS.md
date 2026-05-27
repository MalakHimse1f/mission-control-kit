# Asking the user questions

Stages that need user input (braindump, refine, layout, portfolio, plan review) **must** use the structured ask tool — not questions in chat alone.

## Tool by environment

| Environment | Tool | One question per call |
|-------------|------|------------------------|
| **Cursor** | `AskQuestion` | Yes |
| **Claude Code** | `AskUserQuestion` | Yes |

Do not use the other tool name in the wrong environment.

## Rules

1. **Every question** → invoke the ask tool with a clear prompt and **2+ options** when a choice exists.
2. **One question at a time** — wait for the answer before the next tool call.
3. **PM / UX framing** — describe admin or user experience tradeoffs, not technical implementation forks (see project `CLAUDE.md` / Cursor rules if present).
4. Brief context in chat before the tool call is OK; the question itself must still go through the tool.
5. Use `allow_multiple: true` only when the user may pick more than one option (e.g. **layout targets at `/mc-init` only**).

## Platform / surface — asked once

**Which platforms (web, iOS, Android, desktop) are NEVER asked outside `/mc-init`.**

Later stages read `tech-stack/stack.json` → `layoutTargets`. If missing, send user to `/mc-init` — do not ask in chat or via ask tool.

## Stages (v3 — Orchestrator-driven)

| Stage | Who asks | Typical questions |
|-------|----------|-------------------|
| **`/mc` session start** | Orchestrator | Pipeline scope; decision review mode (see below) |
| `/mc-init` | User runs once | Existing vs greenfield; layout targets; frameworks |
| `/mc-braindump` | Orchestrator | Target codebase folder paths if not in braindump |
| `clarify` (pipeline) | Orchestrator | Requirements grounded in explore findings — one at a time |
| `/mc-portfolio` | Orchestrator | Build order approval |
| `build` (pipeline) | Orchestrator | E2e screenshot capture only |

**Deprecated for user-facing questions:** refine, layout, plan — handled by subagents (`mc-prd`, `mc-mock`, `mc-platform-plan`).

### Session start (`/mc`, pickup prompt paste, ralph resume)

**Every session** — after reading disk (`state.json`, `HANDOFF.md`, active `status.json`, skill artifacts). Brief the user on current stage and suggested next step, then **AskQuestion** (one call at a time).

**Question 1 — pipeline scope** (PM framing; options depend on disk state):

| Option | When to offer | Meaning |
|--------|---------------|---------|
| **Planning only — finish research, PRD, mock, and plan** | `pipelineStage` is braindump–plan, or user pasted pickup during planning | Stop before build; no implementer subagents this session |
| **Full pipeline — plan then build** | Plan exists or stage is early planning | Continuous run through build after planning completes |
| **Build only — skip to implementers** | `phases/*.md`, `tasks[]`, `specStatus: approved` | Skip planning stages; dispatch build subagents |

If only one option makes sense given disk state, still offer it plus **Pause — I'll decide later** (orchestrator stops after saving intent).

Persist answer → `.mc/orchestrator-controls.json` → `sessionIntent.pipelineScope`. See `SESSION-INTENT.md`.

**Question 2 — decision review** (always ask unless user says "use dashboard settings"):

| Option | Meaning |
|--------|---------|
| **Review key decisions with me** | After skill stages, summarize findings and AskQuestion before next dispatch; artifacts visible in dashboard **Skill findings** |
| **Proceed with defaults from research** | Subagents choose grounded defaults; document in journal; user reviews in dashboard later |

Persist → `sessionIntent.decisionReview`.

When `decisionReview` is `review-first`, orchestrator **must** pause after research, strategy, interaction, explore synthesis, clarify, prd, mock, and plan — even if `pipelineScope` is full-pipeline.

When `decisionReview` is `auto-proceed`, still write all skill outputs to disk as self-contained selection-deck HTML pages (`research.html`, `ux-strategy.html`, `interaction.html`, `explore/*.html`) per `layout/selection/SELECTION-UI.md`.

### Present research HTML to the user (orchestrator)

After explore, research, strategy, or interaction stages complete, the orchestrator **must post in chat** (not only write to disk):

1. List each `.html` file path under `docs/superpowers/control/features/{slug}/`
2. Brief highlights (2–4 bullets)
3. **How to view** — dashboard (generate-dashboard → dashboard-server → feature detail → Skill findings / Exploration findings) and local browser

See `layout/selection/SELECTION-UI.md` → **Present to the user**. Helper: `formatResearchPresentationMessage()` in `research-layout.mjs`.

When `decisionReview` is `review-first`, AskQuestion comes **after** the presentation message.

### Build order (`/mc-portfolio`)

After **`spec-portfolio-review`** analyzes interdependencies, **AskQuestion** — PM framing:

Present the **recommended numbered order** from `SPEC-PORTFOLIO-REVIEW.md`. Options:

| Option | Meaning |
|--------|---------|
| **Approve recommended order** | Lock sequence to `state.json` → `buildOrder`; dashboard **Build order** panel shows #1, #2, … |
| **Change order** | User picks a different sequence (must still include every UX feature); agent merges new order then confirms |

One question per tool call. On approval → `portfolioReviewStatus: "approved"`, regenerate dashboard.

**When to run:** 2+ approved UX specs, or after adding a feature that changes dependencies (`portfolioReviewStatus` → `"draft"`).

### Build execution (`/mc` when pipelineStage is build)

**v3 default:** build always uses dedicated subagents via `subagent-driven-development`. The Orchestrator does not offer "this chat" mode unless the user explicitly requests it.

**AskQuestion** — e2e screenshot capture only (see below).

### E2e screenshots (`/mc` or `/mc-build` — every build session)

**Ask after build execution mode** — one question per tool call. PM framing:

| Option | Meaning |
|--------|---------|
| **Save screenshots on the dashboard (recommended for UI work)** | After the **phase-end e2e** finishes (run once per phase, per platform — see `tech-stack/E2E-TOOLS.md`), save PNGs to `features/{slug}/artifacts/phase-N/{platform}/` so you can review visuals in the dashboard drill-down. |
| **Skip screenshots** | Phase-end e2e still runs and must pass for every `layoutTarget`; no PNGs saved. Good for backend-only or tech-setup phases with no UI surface. |

After the answer, set `captureE2eScreenshots` in `state.json` (`true` or `false`) via merge.

**Note:** e2e runs once per phase, against the cumulative UI for that phase — not per task. The phase-end e2e is the gate that proves the real built app works against the real database with seeded test credentials. See `tech-stack/E2E-TOOLS.md` for the platform → MCP mapping and the no-mocks rules.

## Do NOT

- Ask multiple questions in one message without the tool
- Skip the tool because the question "feels simple"
- Default to technical jargon in option labels
