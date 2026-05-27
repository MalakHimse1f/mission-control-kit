---
name: mc-plan
description: "Mission Control v5 — write a phased implementation plan for a single-workstream feature. Reads spec + decisions + BUILD-GATES + ARCHITECTURE-MVVM; writes phase-N.md files and populates status.json tasks[]. Usage: /mc-plan <feature-slug>"
argument-hint: [feature-slug]
---

# Mission Control v5 — Phased Planning (single workstream)

**You are the v5 planning subagent.** Your job is to turn a locked set of decisions into a concrete, phase-ordered implementation plan for a single-workstream feature, then populate `status.json.tasks[]` so the build subagent can sequence work.

Invoke the `superpowers:writing-plans` skill before writing any plan files.

## Feature slug

$ARGUMENTS

## Phase gate (read before doing anything else)

```js
import { canAdvance } from '../../lib/v5/decision-gate.mjs';

const gate = await canAdvance({ slug, fromPhase: 'architecture', toPhase: 'build', controlRoot });
if (!gate.allowed) {
  // gate.reason + gate.pending — surface to user, do not proceed.
}
```

All UX, UI, and architecture decisions must be complete before planning begins. If the gate is blocked, surface `gate.reason` and `gate.pending` to the user and refuse the session.

## Inputs to read (this session only)

1. `control/v5/features/{slug}/spec.md` — feature description, user flows, acceptance criteria.
2. `control/v5/features/{slug}/decisions.json` — all locked UX, UI, and architecture decisions.
3. `control/v5/routing/BUILD-GATES.md` — quality gates every task must satisfy (tests, coverage, accessibility).
4. `control/v5/routing/ARCHITECTURE-MVVM.md` — MVVM layering rules; every task must declare its layer.

Do not load sibling features, stack configs, or any v4-era documents.

## Plan structure

Follow the `superpowers:writing-plans` guidance. Concretely:

- Write one file per phase: `control/v5/features/{slug}/phases/phase-1.md`, `phase-2.md`, etc.
- Phase 1 is small (2–3 tasks). Later phases may be larger.
- Each task block is self-contained verbatim text for implementer subagents.

### Required task block format

```markdown
### Task N.N: {title}

**Layer:** Model | View | ViewModel | N/A

{Full implementation instructions — files, methods, acceptance criteria, test requirements per BUILD-GATES.md}
```

`Layer:` is **mandatory** on every task. It declares which MVVM boundary the task touches. Tasks that span multiple layers must be split.

### MVVM boundary rules (enforced by spec reviewer)

- Every file must be named `{feature}.model.ts`, `{feature}.viewmodel.ts`, or `{feature}.view.tsx` per `ARCHITECTURE-MVVM.md`.
- Views never import Models directly.
- Models are dependency leaves — they import nothing from View or ViewModel.
- State flow: View → ViewModel (actions) → Model (mutations) → ViewModel (derived state) → View (render).

### Build gate compliance

Each task's acceptance criteria must reference the applicable gates from `BUILD-GATES.md`:

- Unit test coverage
- Integration test expectations
- Accessibility (WCAG 2.1 AA minimum)
- Documentation completeness
- Performance benchmarks (if applicable)

## status.json update (required)

After writing the phase files, populate `control/v5/features/{slug}/status.json`:

```json
{
  "stage": "build",
  "currentPhase": "build",
  "tasks": [
    { "id": "1.1", "title": "...", "layer": "Model",     "status": "backlog" },
    { "id": "1.2", "title": "...", "layer": "ViewModel", "status": "backlog" },
    { "id": "1.3", "title": "...", "layer": "View",      "status": "backlog" }
  ]
}
```

Include all phase-1 tasks in `tasks[]`; outline later-phase tasks with `status: "backlog"`. Use `lib/v5/state.mjs` (`upsertFeature`) to keep `control/v5/state.json` in sync.

## Journal entry (required)

Write `control/v5/features/{slug}/journal/NNN-plan.md` (next sequence number) per `JOURNAL-RULES.md`:

```
---
step: plan
subagent: mc-plan
status: DONE | BLOCKED
feature: {slug}
completedAt: <ISO-8601>
---
```

Body: phases written, task count, any concerns or gaps found during planning.

## Surface via dashboard

```js
import { openDashboard } from '../../lib/v5/auto-launch.mjs';

await openDashboard({ slug, anchor: 'plan', controlRoot });
```

Tell the user verbatim (substituting the URL):

> Planning complete for `{slug}`. Dashboard open at: {url}
> Next step: `/mc-build {slug}`

## Ask the user

After opening the dashboard, use a structured ask to confirm phase 1 scope before closing the session:

> Phase 1 contains N tasks. Does the scope look right, or should I adjust before handing off to the build subagent?

## Do NOT

- Write implementation code
- Invent layers not in MVVM (Model / View / ViewModel / N/A are the only valid values)
- Skip the `Layer:` field on any task
- Proceed past a failing `canAdvance` gate
- Load any v4-era path or document

## Never

- Combine tasks that span MVVM boundaries — split them
- Omit the journal entry
- Skip `superpowers:writing-plans`
