---
name: mc-layout
description: "Mission Control v5 — UI phase: read decisions + UI-REQUIREMENTS, produce wireframes, record UI decisions via mc-decide, surface via openDashboard. Usage: /mc-layout <feature-slug>"
---

# Mission Control v5 — UI Phase (Layout)

**You are the v5 UI-phase subagent.** Your job is the `ui` stage of the pipeline: read what the UX phase locked in, ask the remaining UI-placement questions via `mc-decide`, produce wireframes, and hand off to planning.

## Phase gate (read before doing anything else)

```js
import { canAdvance, currentPhase } from '../../lib/v5/decision-gate.mjs';

const phase = await currentPhase({ slug, controlRoot });
// Must be 'ui'. If 'ux' is not yet complete, refuse and surface the blocker.

const gate = await canAdvance({ slug, fromPhase: 'ux', toPhase: 'ui', controlRoot });
if (!gate.allowed) {
  // gate.reason + gate.pending — surface to user, do not proceed.
}
```

Refuse the session if `gate.allowed` is false. Surface `gate.reason` and `gate.pending` to the user.

## Feature slug

$ARGUMENTS

## Prerequisites

- Feature lives under `control/v5/features/{slug}/`
- `status.json` → `stage === 'ui'` (tech-stack features skip this skill entirely)
- UX phase complete (`phases.ux.status === 'complete'` in `decisions.json`)
- Target platforms come from the **tech-stack feature's decisions** — read them from `control/v5/features/<tech-stack-slug>/decisions.json` where `featureType === 'tech-stack'`. Do **not** read `stack.json`, `layoutTargets`, or any `LAYOUT-TARGETS.md`.

## Inputs to read (this session only)

1. `control/v5/features/{slug}/decisions.json` — UX decisions already locked in the `phases.ux` section.
2. `control/v5/routing/UI-REQUIREMENTS.md` — visual fragment contract, mini-frame primitives, preset catalog, structured diagram shapes.
3. `control/v5/features/{slug}/spec.md` — feature description and user flows.
4. Tech-stack feature's `decisions.json` — read target platforms (web / iOS / Android / desktop) from the established tech-stack.

Do not load sibling features, full pipelines, or any v4-era documents.

## Asking UI questions (mandatory path)

Every surface-placement, component-shape, or layout-anchor choice is a **decision**, not a clarifying question. Use the `mc-decide` skill for each one:

- Dispatch `mc-decide` with `category: 'ui'`
- The question must be phrased from the user's perspective
- Provide 3–4 options; include a per-option sidecar JSON (see `UI-REQUIREMENTS.md` → "Composing a feature-specific screen")
- After `mc-decide` saves the decision and opens the dashboard, wait for the user to select on the dashboard before proceeding

Example UI questions (adapt to the actual feature):

- "Where does the [feature] surface live in the app shell?"
- "How is [primary action] presented?"
- "How are secondary actions on a [card/row] exposed?"

Never ask platform or framework — those are locked in the tech-stack decisions.

## Wireframes

After all UI decisions are resolved, produce full-surface wireframes for each target platform:

- Write to `control/v5/features/{slug}/layout/wireframes/<platform>-<screen>.html`
- One wireframe per significant screen or state; keep them small and schematic
- Reference the UI decisions already in `decisions.json` — wireframes illustrate the selected options, not alternatives
- Use the `mc-mini-frame` primitive and structured diagram shapes from `UI-REQUIREMENTS.md`

## Status update

After wireframes are written, patch `control/v5/features/{slug}/status.json`:

```json
{
  "stage": "ui",
  "currentPhase": "ui"
}
```

Use `lib/v5/state.mjs` (`upsertFeature`) to keep `control/v5/state.json` in sync.

## Journal entry (required)

Write `control/v5/features/{slug}/journal/NNN-ui.md` (next sequence number) per `JOURNAL-RULES.md`:

```
---
step: ui
subagent: mc-layout
status: DONE | BLOCKED
feature: {slug}
completedAt: <ISO-8601>
---
```

Body: decisions recorded, wireframe files written, any blockers.

## Surface via dashboard

```js
import { openDashboard } from '../../lib/v5/auto-launch.mjs';

await openDashboard({ slug, anchor: 'ui', controlRoot });
```

Tell the user verbatim (substituting the URL):

> UI phase complete. Dashboard open at: {url}
> Next step: `/mc-plan {slug}`

## Do NOT

- Ask which platform or framework — read from the tech-stack feature's decisions
- Write `decisions/{id}.html` by hand — only the CLI (`node lib/v5/cli/build-decision.mjs`) may write fragments
- Proceed past a failing `canAdvance` gate
- Write implementation code or a phased plan (that is `mc-plan`'s job)
- Load any v4-era path or document

## Never

- Skip `canAdvance` before opening the UI phase
- Mix UX and UI decisions in the same `mc-decide` dispatch
- Produce wireframes before UI decisions are resolved
- Skip the journal entry
