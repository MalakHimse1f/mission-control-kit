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
| `/mc-init` | User runs once | Existing vs greenfield; layout targets; frameworks |
| `/mc-braindump` | Orchestrator | Target codebase folder paths if not in braindump |
| `clarify` (pipeline) | Orchestrator | Requirements grounded in explore findings — one at a time |
| `/mc-portfolio` | Orchestrator | Build order approval |
| `build` (pipeline) | Orchestrator | E2e screenshot capture only |

**Deprecated for user-facing questions:** refine, layout, plan — handled by subagents (`mc-prd`, `mc-mock`, `mc-platform-plan`).

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
