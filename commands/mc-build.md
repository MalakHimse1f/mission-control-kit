---
name: mc-build
description: "Mission Control stage 5 — subagent-driven build from HANDOFF. Usage: /mc-build"
---

# Mission Control — Stage 5: Build

**MUST invoke:** `mission-control` skill, then **`superpowers:subagent-driven-development`** skill (read both before any task work).

**MUST read:** `docs/superpowers/control/AGENT-DATA-RULES.md` — patch active item's `status.json` only; merge `state.json`; regenerate dashboard (never hand-edit it).

Bound by `docs/superpowers/IMPLEMENTATION_RULES.md`.

## Start — every build session

1. Read `HANDOFF.md`, `state.json`, active item's `status.json`.
2. Resolve focus slug (same rules as `/mc` hub). If ambiguous → **AskQuestion**.
3. **AskQuestion** — build execution mode (`USER-QUESTIONS.md`). Wait before coding or dispatching.
4. **AskQuestion** — e2e screenshot capture (`USER-QUESTIONS.md`). Wait before first task.
5. Merge `captureE2eScreenshots: true|false` into `state.json` (merge, do not replace portfolio).
6. Load **verbatim current task block** from `phases/phase-N.md` (full text — do not tell subagents to "read the plan file").

## Subagent mode (recommended — default when user selects dedicated agents)

**Orchestrator role only.** You coordinate; subagents implement and review.

### Per task loop — sequential, one at a time

1. Mark task `in-progress` in `status.json`.
2. **Dispatch implementer subagent** via **Task tool** (Cursor) with:
   - Full verbatim task text from the phase file
   - Item slug, workstream, branch, relevant file paths
   - Instruction to follow **test-driven-development**
   - **No** orchestrator conversation history
3. Handle implementer status: `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, `BLOCKED` per subagent-driven-development skill.
4. **Dispatch spec compliance reviewer** subagent (Task tool) — task text + changed files only.
5. Fix loop until spec reviewer approves.
6. **Dispatch code quality reviewer** subagent (Task tool).
7. Fix loop until quality reviewer approves.
8. **Run e2e tests** (required — orchestrator runs commands, shows output as evidence).
   - **Pass:** brief confirmation in chat.
   - **Fail:** **short failure report** in chat — failing test(s), assertion/message, last relevant log lines. Task stays `in-progress`. Do **not** commit.
9. **E2e fix loop** — repeat until e2e exit 0:
   1. **Dispatch code quality reviewer** subagent — e2e failure output + changed files; must return concrete fix guidance.
   2. **Dispatch implementer/patcher** subagent — apply fix only (no scope creep); follow TDD where applicable.
   3. Re-run e2e (step 8) — report pass or failure again.
   - Task remains `in-progress` throughout this loop.
10. **E2e passed:** if `captureE2eScreenshots` is true, save PNGs to `artifacts/{task-id}/` for the dashboard.
11. **Commit** (one commit per task). Update `status.json` for that task:
   - `status`: `"done"`
   - `commit`: full git SHA (`git rev-parse HEAD`)
   - `commitMessage`: subject line (`git log -1 --pretty=%s`)
   - `updatedAt`: ISO date
12. Update `HANDOFF.md`.
13. Run `node docs/superpowers/control/scripts/generate-dashboard.mjs`.
14. **Next task** — repeat from step 1. **Never** dispatch two implementer subagents in parallel.

### Orchestrator NEVER (subagent mode)

- Writes implementation code directly
- Skips spec or quality review
- Commits or marks a task `done` before e2e exit 0
- Skips the e2e fix loop after a failed run
- Passes "read phase-N.md" instead of verbatim task text
- Dispatches parallel implementers on the same branch

## This-chat mode (when user selects it)

- Implement in the current session with TDD.
- Still update disk + dashboard after each task.
- Still run e2e after code review passes; **fix in a loop** (diagnose → patch → re-run e2e) until exit 0 — same gate as subagent mode.
- Save screenshots to `artifacts/{task-id}/` **only if** user chose capture this session (`captureE2eScreenshots: true` in `state.json`).
- **Only after e2e passes:** commit and record `commit` + `commitMessage` before marking `done`. Task stays `in-progress` while e2e fails.

## Orchestrator reads ONLY

- `HANDOFF.md`
- `state.json` — `activeWorkstream`, `activeFeature`, `activeTechSlug`, `phase`
- Active item's `status.json` under `features/` or `tech-stack/`
- **Verbatim current task block** from `phases/phase-N.md`

## Rotation

After **3–5 tasks** (phase not complete), tell user to start a new chat with `/mc` or `/mc-build` (HANDOFF holds state).

## Session boundary — phase complete (all tasks in phase done)

When **every task** in the current phase is `done`, **MUST** tell the user:

```
Build complete for `{slug}` — phase {N}.

All tasks in this phase are done.

Start a NEW chat and run:
  /mc-validate {slug} phase-{N}

Do not run /mc-build again until validate passes (or you explicitly start the next phase after validate).
```

Optional: `/mc-handoff`

## Session boundary — paused (tasks remain)

When stopping mid-phase (rotation, blocked, or user pause):

```
Build session paused.

Tasks completed this session: [list]
Next task: [id + title]
If blocked on e2e: [short failure summary — task stays in-progress]

Start a NEW chat and run:
  /mc
  or /mc-build
```

Optional: `/mc-handoff`
