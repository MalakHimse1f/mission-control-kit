---
name: mc-resume
description: "Mission Control — resume a v5 feature from its last saved stage. Usage: /mc-resume {slug} or /mc-resume {slug} {stage}"
---

# /mc-resume

Resume the v5 feature named in `$ARGUMENTS` (`{slug}` or `{slug} {stage}`). The hub reads `control/v5/features/{slug}/status.json` and `decisions.json` and continues from the current phase.

Invoke skill: `mc`

Required argument: `{slug}` — optional second token `{stage}` to override the phase derived from `status.json`.
