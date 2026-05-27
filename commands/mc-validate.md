---
name: mc-validate
description: "Mission Control — phase validation gate. Runs tests + e2e, advances pipeline. Usage: /mc-validate <slug> <phase-N>"
---

# /mc-validate

Phase validation gate. Runs unit tests, build, lint, and e2e checks; advances the pipeline on success.

Invoke skill: `mc-validate`

Required argument: `<feature-slug> <phase-N>` — e.g. `billing-portal phase-1`.
