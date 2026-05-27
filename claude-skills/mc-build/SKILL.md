---
name: mc-build
description: "Mission Control stage 5 — subagent-driven build from HANDOFF. Usage: /mc-build"
---

# Mission Control — Stage 5: Build

**MUST invoke:** `mission-control` skill, then **`superpowers:subagent-driven-development`** skill (read both before any task work).

**MUST read:**
- `docs/superpowers/control/AGENT-DATA-RULES.md` — patch active item's `status.json` only; merge `state.json`; regenerate dashboard (never hand-edit it).
- `docs/superpowers/control/tech-stack/E2E-TOOLS.md` — platform-mandated e2e tools and the **real-UI / real-DB / no-mocks** rules. The phase-end e2e gate below uses this mapping.

Bound by `docs/superpowers/IMPLEMENTATION_RULES.md`.

## Prime directive — keep dispatching until the phase is done

**You are the orchestrator. One subagent per task is the dispatch unit, NOT the stopping condition.**

After a task's subagent returns and that task is committed + marked `done`, you **MUST immediately load the next pending task from `phases/phase-N.md` and dispatch the next subagent**. Do not summarize, do not ask the user "should I continue?", do not wait. Keep looping through tasks until **one** of these stop conditions is hit:

1. **Hard blocker** — a subagent returns `BLOCKED`, a per-task test fix loop or the phase-end e2e fix loop cannot converge, or you need user input you cannot resolve from disk → report blocker and stop.
2. **User pause** — the user explicitly tells you to stop.

If none of those apply, the correct action is **always** "dispatch the next subagent." Stopping after one task is a bug.

**After phase-end e2e is green:** immediately run the validate gate inline (same session) — see `/mc-validate`. Then continue to next phase or mark feature done. **Never** tell the user to start a new chat.

## Start — every build session

1. Read `HANDOFF.md`, `state.json`, active item's `status.json`.
2. Resolve focus slug (same rules as `/mc` hub). If ambiguous → **AskQuestion**.
3. **AskQuestion** — build execution mode (`USER-QUESTIONS.md`). Wait before coding or dispatching.
4. **AskQuestion** — e2e screenshot capture for the phase-end run (`USER-QUESTIONS.md`). Wait before first task.
5. Merge `captureE2eScreenshots: true|false` into `state.json` (merge, do not replace portfolio).
6. Load **verbatim current task block** from `phases/phase-N.md` (full text — do not tell subagents to "read the plan file").
7. **Check `tech-stack/stack.json` → `layoutTargets[]`** and confirm the matching MCP(s) from `tech-stack/E2E-TOOLS.md` are reachable. If missing, surface as a blocker before the first task — do not let tasks pile up only to fail at phase-end.

## Subagent mode (recommended — default when user selects dedicated agents)

**Orchestrator role only.** You coordinate; subagents implement and review.

### Per task loop — sequential, one at a time

1. Mark task `in-progress` in `status.json`.
2. **Dispatch implementer subagent** via **Task tool** with:
   - Full verbatim task text from the phase file
   - Item slug, workstream, branch, relevant file paths
   - Instruction to follow **test-driven-development**
   - **No** orchestrator conversation history
3. Handle implementer status: `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, `BLOCKED` per subagent-driven-development skill.
4. **Dispatch spec compliance reviewer** subagent (Task tool) — task text + changed files only.
5. Fix loop until spec reviewer approves.
6. **Dispatch code quality reviewer** subagent (Task tool).
7. Fix loop until quality reviewer approves.
8. **Run unit + integration tests** for the task (required — orchestrator runs commands, shows output as evidence). These are the TDD tests the implementer wrote — **not** e2e. E2e runs once, at phase end (see below).
   - **Pass:** brief confirmation in chat.
   - **Fail:** **short failure report** in chat — failing test(s), assertion/message, last relevant log lines. Task stays `in-progress`. Do **not** commit.
9. **Test fix loop** — repeat until tests exit 0:
   1. **Dispatch code quality reviewer** subagent — failure output + changed files; must return concrete fix guidance.
   2. **Dispatch implementer/patcher** subagent — apply fix only (no scope creep); follow TDD where applicable.
   3. Re-run tests (step 8) — report pass or failure again.
   - Task remains `in-progress` throughout this loop.
10. **Commit** (one commit per task). Update `status.json` for that task:
    - `status`: `"done"`
    - `commit`: full git SHA (`git rev-parse HEAD`)
    - `commitMessage`: subject line (`git log -1 --pretty=%s`)
    - `updatedAt`: ISO date
11. Update `HANDOFF.md`.
12. Run `node docs/superpowers/control/scripts/generate-dashboard.mjs`.
13. **If pending tasks remain in the phase:** immediately dispatch the next task. Check `status.json` for the next `pending` task; load its verbatim block from `phases/phase-N.md`; repeat from step 1. **Do not** stop, summarize, or ask the user whether to continue — only stop on a Prime Directive stop condition. **Never** dispatch two implementer subagents in parallel.
14. **If this was the last task in the phase:** go to **Phase-end e2e** below — do **not** emit the phase-complete boundary yet.

### Phase-end e2e — platform-mandated, real UI, real DB

**Runs once per phase, after every task in the phase is `done`. This is the e2e gate.**

**Every dispatch in this section is a FRESH subagent.** No subagent context survives between iterations of the fix loop — not the e2e runner, not the diagnostic reviewer, not the patcher. Each role gets a clean Task tool invocation with only the inputs it needs (task text, changed files, last failure output). This prevents context bleed and keeps each subagent's reasoning isolated to its current job.

Before continuing to validate:

1. **Determine targets.** Read `tech-stack/stack.json` → `layoutTargets[]`. If empty (no UI surface), skip to step 6.
2. **Confirm tools.** For each `layoutTarget`, look up the required MCP in `tech-stack/E2E-TOOLS.md`. Confirm the MCP is reachable. If not, **blocker** — report and stop.
3. **Seed test data if required.** If any phase task introduced UI that needs historical data (e.g., "render last 30 days of workouts"), seed via the cloud DB's MCP (Supabase MCP for Supabase projects; equivalent for other backends) **before** the run. Use real schemas and the same auth path the app uses — never bypass RLS / row policies.
4. **Dispatch a fresh e2e runner subagent per `layoutTarget`.** Each subagent uses the platform's MCP per `E2E-TOOLS.md`:
   - `web-saas` / `web-marketing` → Playwright (+ Chrome DevTools MCP for triage if needed)
   - `ios-tab-nav` / `ios-hamburger` → XcodeBuildMCP (getsentry)
   - `android-tab-nav` / `android-hamburger` → CursorTouch/Android-MCP
   - `desktop-mac` / `desktop-windows` → Playwright (Electron) or native runner per stack
   Each subagent must exercise the **real built app** against the **real database** using the project's seeded test credentials. No mocks, no DB stubs, no auth bypasses. (See `E2E-TOOLS.md` § Hard rules.) The subagent returns the exit code + a structured failure report (failing spec/file, assertion, last 30 log lines) — **do not** have the orchestrator run e2e directly.
5. **Phase-end e2e fix loop** — repeat until every platform's e2e exits 0. Each iteration is **three fresh subagents**, dispatched sequentially:
   1. **Identify scope.** Read the failing e2e subagent's report. Identify the offending task(s). Re-open them: set their `status.json` entry back to `"in-progress"`.
   2. **Dispatch a fresh diagnostic-reviewer subagent** (code quality reviewer role) — inputs: e2e failure report + changed files. Returns concrete fix guidance. **New Task invocation every iteration** — do not reuse the previous reviewer's context.
   3. **Dispatch a fresh patcher subagent** (implementer/patcher role) — inputs: the diagnostic reviewer's guidance + the verbatim task text. Applies the fix only (no scope creep); follows TDD where applicable. **New Task invocation every iteration** — never reuse the patcher from a prior iteration even if the same task is being fixed again.
   4. **Dispatch a fresh e2e runner subagent** for the failing `layoutTarget`(s) — same inputs and platform MCP as step 4, fresh Task invocation. Returns exit code + structured failure report.
   5. If exit 0 for every reopened platform → exit the loop. If still failing → loop back to substep 2 with **three new fresh subagents**.
   - The reopened task(s) stay `in-progress` throughout this loop. Re-commit and re-mark `done` when the fix lands and e2e passes.
   - **Loop cap:** if the same failure persists after 5 iterations, treat as a hard blocker and stop. Do not silently keep looping.
6. **All platforms green:** if `captureE2eScreenshots: true`, save PNGs from each platform's run to `features/{slug}/artifacts/phase-N/{platform}/` (or `tech-stack/{slug}/artifacts/phase-N/{platform}/` for tech-stack items). Regenerate the dashboard.
7. **Immediately run validate inline** (same session) — orchestrator executes `/mc-validate {slug} phase-N` flow. On pass → next phase (plan/build) or feature done. **Do not** emit "start new chat."

### Orchestrator NEVER (subagent mode)

- Writes implementation code directly
- Skips spec or quality review
- Commits or marks a task `done` before its unit + integration tests exit 0
- Emits the phase-complete boundary before the **phase-end e2e** for every `layoutTarget` exits 0
- Skips the phase-end e2e fix loop after a failed run
- Tells the user to start a **new chat** after phase-end e2e or between phases
- **Runs e2e directly** instead of dispatching a fresh e2e runner subagent (initial run **and** every fix-loop re-run must be a subagent dispatch)
- **Reuses a subagent context across fix-loop iterations** — every iteration is three fresh Task invocations (diagnostic reviewer → patcher → e2e runner). Never resume a prior subagent.
- Substitutes a different e2e tool for the one mandated by `E2E-TOOLS.md` (e.g., running web-only e2e when `layoutTargets` includes iOS or Android)
- Allows mocks, DB stubs, or fake auth in the phase-end e2e (see `E2E-TOOLS.md` § Anti-patterns)
- Passes "read phase-N.md" instead of verbatim task text
- Dispatches parallel implementers on the same branch
- **Stops after a single task with pending tasks remaining in the phase** (unless a Prime Directive stop condition above is hit)
- Asks the user "should I continue with the next task?" between tasks — the answer is always yes until a stop condition fires

## This-chat mode (when user selects it)

- Implement in the current session with TDD.
- Per task: unit + integration tests must pass before commit (same gate as subagent mode). No per-task e2e.
- Still update disk + dashboard after each task.
- **After the last task in the phase:** run the same **Phase-end e2e** above — read `layoutTargets`, use the MCP per `E2E-TOOLS.md`, real UI + real DB + test credentials, fix loop on failure.
- Save screenshots to `features/{slug}/artifacts/phase-N/{platform}/` (or `tech-stack/.../`) **only if** user chose capture this session (`captureE2eScreenshots: true` in `state.json`).
- **Prime Directive still applies:** after a task is committed and marked `done`, immediately start the next pending task in the phase. Do not stop or ask "should I continue?" until a Prime Directive stop condition fires.

## Orchestrator reads ONLY

- `HANDOFF.md`
- `state.json` — `activeWorkstream`, `activeFeature`, `activeTechSlug`, `phase`
- Active item's `status.json` under `features/` or `tech-stack/`
- **Verbatim current task block** from `phases/phase-N.md`

## HANDOFF checkpoint (every 5 build tasks)

Every **5 tasks committed**: update `HANDOFF.md` with progress checkpoint — then **keep dispatching**. Do not stop unless BLOCKED or user pauses.

## On BLOCKED only

When stopping due to blocker or user pause, report status briefly. User may run `/mc` later to resume from disk — same continuous-run rules apply.
