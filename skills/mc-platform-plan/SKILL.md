---
name: mc-platform-plan
description: "Mission Control v5 — subagent that writes ALL platform phase plans in one pass for naming consistency (web/iOS/Android/desktop). Reads spec + decisions + BUILD-GATES + ARCHITECTURE-MVVM; writes phase-N.md files and populates status.json tasks[]. Orchestrator dispatches exactly one instance."
---

# Mission Control v5 — Platform-wide Phased Planning (subagent)

**You are a subagent.** The orchestrator dispatches exactly one instance of this skill so that shared service names, method names, and file paths stay consistent across all target platforms (web, iOS, Android, desktop) in a single pass.

Invoke the `superpowers:writing-plans` skill before writing any plan files.

## Inputs (provided by the orchestrator's dispatch packet)

- Feature slug
- `control/v5/features/{slug}/spec.md`
- `control/v5/features/{slug}/decisions.json` — all locked UX, UI, and architecture decisions
- `control/v5/routing/BUILD-GATES.md`
- `control/v5/routing/ARCHITECTURE-MVVM.md`
- Target platforms — read from the **tech-stack feature's decisions** in `control/v5/features/<tech-stack-slug>/decisions.json` where `featureType === 'tech-stack'`. Do **not** read `stack.json`, `layoutTargets`, or any `LAYOUT-TARGETS.md`.
- Wireframes from `control/v5/features/{slug}/layout/wireframes/` (if present)

## Phase gate (read before doing anything else)

```js
import { canAdvance } from '../../lib/v5/decision-gate.mjs';

const gate = await canAdvance({ slug, fromPhase: 'architecture', toPhase: 'build', controlRoot });
if (!gate.allowed) {
  // Refuse the dispatch — flag the blocker in the journal as BLOCKED.
}
```

If the gate is blocked, write a BLOCKED journal entry and stop. Do not produce plan files.

## Outputs (all required before DONE)

1. `control/v5/features/{slug}/phases/phase-1.md`, `phase-2.md`, … — phased tasks.
2. `control/v5/features/{slug}/status.json` → `tasks[]` populated from phase 1 (outline later phases with `status: "backlog"`).
3. `control/v5/features/{slug}/journal/NNN-plan.md` — per `JOURNAL-RULES.md`.

## Cross-platform consistency (critical)

At the top of **each** phase file, include a **Platform alignment** section that defines shared names across all target platforms:

```markdown
## Platform alignment

| Concept | Shared name | Web path | iOS path | Android path |
|---------|-------------|----------|----------|--------------|
| Service | `SessionService` | `src/services/session.ts` | `SessionService.swift` | `SessionService.kt` |
| ViewModel | `SessionViewModel` | `session.viewmodel.ts` | `SessionViewModel.swift` | `SessionViewModel.kt` |
```

Every task that touches multiple platforms must reference the **same** service and method names from this table. Define the table once in phase 1 and carry it forward. Naming drift across platforms is a planning failure.

## Plan structure

Follow the `superpowers:writing-plans` guidance:

- Phase 1 is small (2–3 tasks). Later phases may be larger.
- Each task block is self-contained verbatim text for implementer subagents — do not tell implementers to "read the plan file".

### Required task block format

```markdown
### Task N.N: {title}

**Platform(s):** web, ios, android, desktop (list only those this task touches)
**Layer:** Model | View | ViewModel | N/A

{Full implementation instructions — files, methods, acceptance criteria, test requirements per BUILD-GATES.md}
```

Both `Platform(s):` and `Layer:` are **mandatory** on every task. Tasks that span MVVM layers must be split. Tasks that span platforms are allowed only when the work is genuinely identical across them (e.g., writing a shared schema).

### MVVM boundary rules (enforced by spec reviewer)

- File naming: `{feature}.model.ts`, `{feature}.viewmodel.ts`, `{feature}.view.tsx` (or platform-idiomatic equivalents: `.swift`, `.kt`).
- Views never import Models directly.
- Models are dependency leaves.
- State flow: View → ViewModel (actions) → Model (mutations) → ViewModel (derived state) → View (render).

See `control/v5/routing/ARCHITECTURE-MVVM.md` for the full rule set and worked examples.

### Build gate compliance

Each task's acceptance criteria must reference the applicable gates from `control/v5/routing/BUILD-GATES.md`:

- Unit test coverage
- Integration test expectations
- Accessibility (WCAG 2.1 AA minimum per platform)
- Documentation completeness
- Performance benchmarks (if applicable)

## status.json update (required)

After writing the phase files, populate `control/v5/features/{slug}/status.json`:

```json
{
  "stage": "build",
  "currentPhase": "build",
  "tasks": [
    { "id": "1.1", "title": "...", "layer": "Model",     "platforms": ["web","ios"], "status": "backlog" },
    { "id": "1.2", "title": "...", "layer": "ViewModel", "platforms": ["web","ios"], "status": "backlog" }
  ]
}
```

Use `lib/v5/state.mjs` (`upsertFeature`) to keep `control/v5/state.json` in sync.

## Journal entry (required)

Write `control/v5/features/{slug}/journal/NNN-plan.md` (next sequence number) per `JOURNAL-RULES.md`:

```
---
step: plan
subagent: mc-platform-plan
status: DONE | BLOCKED
feature: {slug}
completedAt: <ISO-8601>
---
```

Body: platforms covered, phases written, task count, cross-platform alignment table, any concerns or naming conflicts flagged during planning.

## Surface via dashboard

```js
import { openDashboard } from '../../lib/v5/auto-launch.mjs';

await openDashboard({ slug, anchor: 'plan', controlRoot });
```

## Do NOT

- Ask the user questions — flag any gaps in the journal under a "Concerns" section
- Split planning work across multiple subagent dispatches
- Drift service/method names between platforms
- Invent layers not in MVVM (Model / View / ViewModel / N/A)
- Skip the `Layer:` or `Platform(s):` field on any task
- Proceed past a failing `canAdvance` gate
- Load any v4-era path or document

## Never

- Write `decisions/{id}.html` by hand
- Combine tasks that span MVVM boundaries
- Omit the journal entry
- Skip `superpowers:writing-plans`
- Dispatch multiple instances of this skill for the same feature (naming consistency is the whole point)
