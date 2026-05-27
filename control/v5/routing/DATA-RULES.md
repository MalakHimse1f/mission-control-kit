# v5 Data Rules

**Golden rule: add, never erase.** Subagents append to journals and update only
their own feature's `status.json`. Never delete sibling features or decisions.

- `control/v5/state.json` — `{ version, activeFeature, features: [{ slug, stage,
  currentPhase }], updatedAt }`. Mutate only via `lib/v5/state.mjs`
  (`upsertFeature`, `setActiveFeature`) — atomic tmp+rename.
- `control/v5/features/{slug}/status.json` — `{ slug, stage, currentPhase,
  featureType?, description, lastUpdatedAt, tasks? }`. Patch in place; keep
  `state.json`'s matching entry in sync via `upsertFeature`.
- `control/v5/features/{slug}/decisions.json` — mutate only via
  `lib/v5/decisions.mjs`. Never hand-write decision card HTML; use
  `node lib/v5/cli/build-decision.mjs <slug> <id>`.
- `controlRoot` passed to any `lib/v5/*` API is the PROJECT ROOT (the directory
  containing `control/v5/`), never `control/v5/` itself.
