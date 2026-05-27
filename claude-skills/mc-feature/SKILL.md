---
name: mc-feature
description: "Mission Control — add a new feature: scaffold control/v5/features/{slug}/ and drive it through the v5 pipeline. Usage: /mc-feature"
---

# Mission Control — Add Feature (v5)

**You are the Orchestrator.** Scaffold the feature, then hand control to the `mc` hub and run the v5 pipeline continuously in one session.

## Raw input

$ARGUMENTS

## Step 0 — Vendor check (optional)

If `control/vendor/manifest.json` is missing or vendor bundles are not yet installed, dispatch the `mc-setup-skills` subagent to install them before proceeding.

## Step 1 — Derive slug

Convert the user's feature description to a kebab-case `{slug}` (e.g., "User notifications" → `user-notifications`).

## Step 2 — Scaffold the feature

```bash
node lib/v5/cli/new-feature.mjs <slug> --description "<feature description>"
```

This creates:
- `control/v5/features/{slug}/status.json` — initial stage/phase/featureType
- `control/v5/features/{slug}/decisions.json` — empty decision list
- Registers the feature entry in `control/v5/state.json`

Then mark the feature active via `setActiveFeature(slug, { controlRoot })` from `lib/v5/state.mjs`, or confirm the `mc` hub will do so on its first session-start read.

## Step 3 — Hand off to the v5 pipeline

Invoke the `mc` hub (dispatch as a subagent or continue as the orchestrator). The `mc` hub drives the full pipeline:

### Pipeline order (per `control/v5/routing/PIPELINE.md`)

| Stage | Skill dispatched | Produces |
|-------|-----------------|----------|
| brainstorm | `mc-braindump` | `braindump.md` |
| explore | `mc-explore` | codebase map |
| ux | `mc-prd` + UX decisions via `mc-decide` | `spec.md`, `decisions.json` (ux phase) |
| ui | `mc-layout` / `mc-mock` + UI decisions via `mc-decide` | wireframes in `layout/wireframes/*.html` |
| architecture | architecture decisions via `mc-decide` | `decisions.json` (architecture phase) |
| build | `mc-build` | code, phase plans |
| validate | `mc-validate` | test + e2e gate |

**Tech-stack features** (`status.json.featureType === "tech-stack"`) skip `ux`/`ui` and start at `architecture`.

### Before every dispatch

Resolve a context route via `resolveRoute` from `lib/v5/mc-router.mjs`. The subagent receives **only** the documents in `route.docs` — no whole-feature dumps.

### Phase gating

Before advancing between phases call `canAdvance({ slug, fromPhase, toPhase, controlRoot })` from `lib/v5/decision-gate.mjs`. Do **not** advance if `gate.allowed` is false; surface `gate.pending` to the user and resolve all pending decisions first.

### Decisions

Capture every UX/UI/architecture choice via the `mc-decide` skill:
1. Write the decision into `control/v5/features/{slug}/decisions.json` via `lib/v5/decisions.mjs`.
2. Run `node lib/v5/cli/build-decision.mjs <slug> <decision-id>` to generate the visual fragment.
3. Call `openDashboard({ slug, anchor: 'decisions' })` from `lib/v5/auto-launch.mjs` to surface the visual.

Vendor skills are referenced through `control/vendor/manifest.json`. During the UX/UI phases, dispatch the `designer-skills` research skills — `design-research`, `ux-strategy` — to ground pattern choices before encoding decisions. The `mc-prd` subagent must invoke `prd-generator` before writing `spec.md`.

### Asking the user

- **UX/UI/architecture choices** → `mc-decide` + dashboard. Never use `AskUserQuestion` for these.
- **Clarifying questions** → `AskUserQuestion` with 1–4 mutually exclusive options.

## Step 4 — Continuous run

The orchestrator does not stop between stages (per `control/v5/routing/PIPELINE.md`). Each stage: read disk → resolve route → dispatch narrow subagent → read journal → gate advance → next stage.

Surface all artifacts with `openDashboard(...)` from `lib/v5/auto-launch.mjs`.
