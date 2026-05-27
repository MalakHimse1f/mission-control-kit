---
name: mc-refine
description: "Mission Control v5 — resume or refine a feature's decisions or spec. Reads the feature's spec.md, decisions.json, and status.json from control/v5/features/, re-runs brainstorming or adjusts decisions, routes all decision changes through mc-decide, updates status.json, and opens the dashboard. Usage: /mc-refine <slug>"
argument-hint: [feature-slug]
---

# Mission Control v5 — Refine

**You are the v5 refine orchestrator.** Use this skill when a feature's spec or decisions need to be revisited — e.g., brainstorming was incomplete, a decision needs to be reconsidered, or the spec needs adjustment before the next pipeline stage.

**If starting a brand-new feature:** use `/mc feature <description>` instead.

## Slug

`$ARGUMENTS` — the feature slug to refine. Must match a directory under `control/v5/features/`.

## Session start (mandatory)

1. Resolve the slug from `$ARGUMENTS`.
2. Confirm the feature directory `control/v5/features/{slug}/` exists. If it does not, stop and tell the user.
3. Read `control/v5/features/{slug}/spec.md`.
4. Read `control/v5/features/{slug}/decisions.json` via `readDecisions(slug, { controlRoot })` from `lib/v5/decisions.mjs`.
5. Read `control/v5/features/{slug}/status.json`.
6. Brief the user: slug, current `stage`, active decision phase, pending decisions, deferred questions, and what refinement is needed.

`controlRoot` is the PROJECT ROOT (the directory containing `control/v5/`).

## Refinement modes

Choose the mode based on what needs to be changed:

### Mode A — Re-run brainstorming

Use when the spec is incomplete, unclear, or the user wants to explore different directions.

1. Invoke the `superpowers:brainstorming` skill.
2. On completion, update `control/v5/features/{slug}/spec.md` with the revised spec content.
3. Update `control/v5/features/{slug}/status.json` — set `stage` to `brainstorming` if it was previously beyond that, or keep it at its current stage if brainstorming only adds detail without invalidating prior decisions.

### Mode B — Adjust a decision

Use when the user wants to reconsider a specific UX, UI, or architecture decision that was already captured.

1. Identify the decision `id` to reconsider (from `decisions.json`).
2. Route through the `mc-decide` skill — this is the **only** sanctioned path for writing to `decisions.json`. Never hand-edit `decisions.json` or fragment HTML directly.
3. `mc-decide` will write the updated entry, regenerate the visual fragment, and open the dashboard.

### Mode C — Add a missing decision

Use when a required decision was deferred or skipped.

1. Check `decisions.json.deferred` for queued questions.
2. Route through the `mc-decide` skill for each decision to capture.

## Asking the user (mandatory — pick the right path)

Every time you would pause to ask something, decide first: **is this a decision or a clarifying question?**

- **Decision** (UX/UI/architecture choice) → dispatch `mc-decide`. Never use `AskUserQuestion` for design choices.
- **Clarifying question** (scope, disambiguation, plain Q&A) → use `AskUserQuestion` (Claude Code) or ask directly in chat (Cursor). Never bury the question in prose.

## Update status after refinement

After refinement is complete, patch `control/v5/features/{slug}/status.json`:

- Set `stage` to the appropriate pipeline stage given what changed. If decisions were adjusted, the stage should reflect the phase that was modified (e.g., if a UX decision changed, revert to `ux-decisions` if that phase needs re-gating).
- Keep `state.json` in sync by calling `upsertFeature({ slug, stage, currentPhase }, { controlRoot })` from `lib/v5/state.mjs`.

## Open the dashboard

After refinement is complete (and after `mc-decide` has been dispatched if decisions changed), call `openDashboard({ slug, anchor: 'decisions', controlRoot })` from `lib/v5/auto-launch.mjs`.

Tell the user verbatim (substituting the URL):

> Refinement complete. Dashboard opened at: {url}

## Data rules

- `controlRoot` is the PROJECT ROOT (the directory containing `control/v5/`), never `control/v5/` itself.
- Never write to `decisions.json` directly. All decision changes go through `mc-decide`.
- Never write fragment HTML by hand. The CLI `node lib/v5/cli/build-decision.mjs <slug> <id>` is the only sanctioned author (and `mc-decide` calls it).
- Mutate `state.json` only via `lib/v5/state.mjs`.

## Pipeline continuation

After refinement, the `mc` hub owns pipeline routing. Do not branch directly into layout or plan steps from this skill. If the user wants to continue down the pipeline, they should run `/mc` or `/mc resume {slug}`.

## Never

- Start a new feature — use `/mc feature <description>` instead
- Skip `mc-decide` for any decision change — hand-editing `decisions.json` is a data-integrity violation
- Set `specStatus: "approved"` or any v4 state fields
- Skip `openDashboard` — the user must see the updated visuals in the dashboard
- Load sibling feature data — this skill is scoped to one slug at a time
