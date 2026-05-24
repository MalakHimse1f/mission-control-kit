---
step: build
subagent: implementer
status: DONE
feature: safe-upgrade
taskId: 1.5
completedAt: 2026-05-24T12:00:00.000Z
---

# Build — safe-upgrade phase 1

## Summary

Implemented lib/mc-upgrade.mjs, scripts/mc-upgrade.mjs, kit-manifest.json, migrations, install.sh delegation, /mc-upgrade command+skill, dashboard version strip.

## Verification

- test: `npm test` → all pass
- integration: user spec preserved across upgrade in temp project
