---
name: mc-refine
description: "Mission Control v5 — resume or refine a feature's decisions or spec. Reads spec.md, decisions.json, and status.json, re-runs brainstorming, routes changes through mc-decide. Usage: /mc-refine <slug>"
---

# /mc-refine

Resume or refine a feature's decisions or spec. Reads the feature's `spec.md`, `decisions.json`, and `status.json` from `control/v5/features/`, re-runs brainstorming or adjusts decisions, routes all decision changes through mc-decide, and opens the dashboard.

Invoke skill: `mc-refine`

Required argument: `<feature-slug>`.
