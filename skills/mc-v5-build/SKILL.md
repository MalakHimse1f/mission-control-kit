---
name: mc-v5-build
description: "Mission Control v5 stage 5 — subagent-driven build with MVVM enforcement. Usage: /mc-v5-build"
---

# Mission Control v5 — Stage 5: Build (MVVM-enforced)

**MUST invoke:** `mission-control` skill, then **`superpowers:subagent-driven-development`** skill (read both before any task work).

**MUST read:**
- `control/v5/routing/ARCHITECTURE.md` — MVVM layering rules, file-naming conventions, allowed import directions, data-flow diagram.
- `control/v5/routing/BUILD-GATES.md` — gate requirements for each phase.
- `docs/superpowers/control/AGENT-DATA-RULES.md` — patch `status.json` only; merge `state.json`; regenerate dashboard.

Bound by `docs/superpowers/IMPLEMENTATION_RULES.md`. This skill REPLACES `mc-build` for v5 features — do **not** mix v4 and v5 build flows in the same session.

## Why this exists

v4 build subagents produced inconsistent code architecture. v5 standardizes on **MVVM (Model-View-ViewModel)** so every feature has the same layered shape and the spec reviewer can catch boundary violations mechanically.

## MVVM layering rules (load-bearing)

Every v5 feature is organized into three layers. Each task targets **exactly one** layer.

- **Model** — Data layer. Types, API contracts, persistence, validation. Pure data + IO. **No** React, no DOM, no view code.
- **View** — UI layer. Renders state, dispatches user actions. **No** business logic, **no** direct data fetching, **no** Model imports.
- **ViewModel** — Business logic and state management. Bridges View and Model: subscribes to Model state, exposes derived state and actions to the View, handles side effects.

### File-naming convention (mandatory)

Every feature ships with three sibling files in the same directory:

| Layer | File pattern |
|-------|--------------|
| Model | `{feature}.model.ts` |
| View | `{feature}.view.tsx` |
| ViewModel | `{feature}.viewmodel.ts` |

`.jsx`/`.js` variants are accepted by the linter for JS-only projects, but TypeScript is preferred. The task spec must use exactly these names — do **not** invent alternates like `{feature}-model.ts` or `{feature}/index.tsx`.

### Boundary rules

- **Views never import Models directly.** A View must only know about its ViewModel.
- **ViewModels are the bridge.** ViewModels import the Model (for types and actions) and expose a narrow interface to the View.
- **Models do not import Views or ViewModels.** Models are dependency leaves.

### State flow

```
View ── action ──▶ ViewModel ── mutation ──▶ Model
 ▲                     │                       │
 │                     ◀─── derived state ─────┘
 │                     │
 └──── render ─────────┘
```

Read this loop both ways: user actions travel down (`View → ViewModel → Model`), and state updates travel back up (`Model → ViewModel → View`).

## Task spec requirements (orchestrator)

When the orchestrator dispatches a build subagent, the task spec **must**:

1. Name the target layer explicitly. Example: `Layer: ViewModel`.
2. List the files the task is allowed to touch using the naming convention.
3. State which sibling files already exist (so the implementer doesn't recreate them).
4. Include the relevant MVVM section of `ARCHITECTURE.md` verbatim (the routing layer handles this).

A task spec that does not name its layer is **incomplete** and must be returned to the planner.

## Per-task loop (subagent mode)

Inherits the loop from `mc-build` (v4) with two additions marked **[v5]**:

1. Mark task `in-progress` in `status.json`.
2. **Dispatch implementer subagent** via Task tool with verbatim task text, item slug, branch, MVVM layer label, allowed files.
3. **[v5]** Implementer follows TDD and produces code that respects the MVVM boundary rules above. The implementer is told that the spec reviewer will run `lib/v5/mvvm-lint.mjs` against the diff.
4. **Dispatch spec compliance reviewer** subagent — task text + changed files. The reviewer:
   - **[v5]** Runs `node -e "import('./lib/v5/mvvm-lint.mjs').then(m => m.lintFiles({ root: process.cwd(), files: [...changedFiles] }).then(r => console.log(JSON.stringify(r, null, 2))))"` (or imports the module directly in a script) on the changed files.
   - Treats any violation from `mvvm-lint` as a blocking finding unless the implementer provides a justification that the reviewer explicitly accepts.
   - Confirms the task only touched the named layer.
5. Fix loop until spec reviewer approves.
6. **Dispatch code quality reviewer** subagent.
7. Fix loop until quality reviewer approves.
8. Run unit + integration tests.
9. **Test fix loop** (diagnostic reviewer → patcher → re-run) until tests exit 0.
10. **Commit** (one commit per task). Update `status.json` with `done`, full git SHA, commit message subject, ISO `updatedAt`.
11. Update `HANDOFF.md`. Regenerate dashboard.
12. **If pending tasks remain:** immediately dispatch the next task. Never ask "should I continue?".
13. **If last task in phase:** run the phase-end e2e gate from `mc-build` (no v5-specific changes here).

## What the spec reviewer must check

Beyond the v4 spec-compliance checks:

- Every `*.view.{ts,tsx,jsx}` file imports **only** from its ViewModel (and unrelated libraries). It does **not** import a `*.model.*` file.
- No `*.view.*` file contains `fetch(`, `axios.`, `await db.`, or `new XMLHttpRequest(`.
- Every `*.model.*` file is a dependency leaf — no imports of `*.view.*`.
- Every directory that contains a `*.view.tsx` also contains a sibling `*.viewmodel.{ts,tsx}`.
- The names match `{feature}.model.ts`, `{feature}.view.tsx`, `{feature}.viewmodel.ts`.

The linter encodes these as four violation types: `view-imports-model`, `view-has-data-fetch`, `model-imports-view`, `view-missing-viewmodel`. If `mvvm-lint` returns any violation, the reviewer must either request a fix or document the exemption in the task's review notes.

## Orchestrator NEVER (v5 additions)

- Dispatches a build subagent without a `Layer:` field in the task spec.
- Accepts a spec review that did not run `lib/v5/mvvm-lint.mjs`.
- Allows the implementer to combine Model + View + ViewModel changes in a single task (each layer is its own task).
- Lets a feature ship without the three sibling files (Model, View, ViewModel) unless the architecture decision explicitly notes the layer is N/A (e.g., a Model-only library has no View).

## When MVVM does not apply

Some tasks are pure scaffolding (CI setup, migrations, lint config). These tasks:

- Set `Layer: N/A` in the task spec.
- Are exempt from `mvvm-lint` (the linter ignores files outside the `*.model.*`, `*.view.*`, `*.viewmodel.*` patterns).
- Should still pass spec + quality review on their own merits.

## Reads only

- `HANDOFF.md`
- `state.json` — `activeWorkstream`, `activeFeature`, `phase`
- Active item's `status.json` under `control/v5/features/{slug}/`
- Verbatim current task block from `phases/phase-N.md`
- `control/v5/routing/ARCHITECTURE.md` (MVVM contract)
- `control/v5/routing/BUILD-GATES.md`

## On BLOCKED only

Report status briefly. User may run `/mc-v5` later to resume from disk — same continuous-run rules apply.
