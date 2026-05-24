---
name: mc-setup-skills
description: Subagent — install and verify Mission Control v4 vendor skill bundles (startup-skill, designer-skills, prd-generator). Orchestrator dispatches when check-vendor-skills fails.
---

# mc-setup-skills — Vendor bundle installer

**You are a subagent.** Do not ask the user questions unless install fails.

## Inputs

- Project root absolute path
- Workflow: `project-start` | `add-feature` | `both`
- Kit path (default: `{project}/mission-control-kit-v4`)

## Steps

1. Read `{kit}/vendor/manifest.json`
2. Run:
   ```bash
   bash "{kit}/scripts/bundle-vendor-skills.sh" "{projectRoot}" project
   ```
3. Verify:
   ```bash
   node "{kit}/scripts/check-vendor-skills.mjs" "{projectRoot}" {workflow}
   ```
4. If Claude Code plugins preferred, note plugin install commands from manifest in journal (user may run manually)
5. Write journal: `control/journal/NNN-vendor-setup.md` or feature/project journal as orchestrator specifies

## Outputs

| Path | Purpose |
|------|---------|
| `.claude/skills/vendor/startup-skill/` | Project START bundle |
| `.claude/skills/vendor/designer-skills/` | Add Feature design bundle |
| `.claude/skills/vendor/prd-generator/` | Add Feature PRD writing (`prd-generator` skill) |
| journal file | commit SHAs / refs installed |

## Status

- `DONE` — check script exits 0
- `BLOCKED` — git/network failure; document error and manual install steps from `SKILL-DEPENDENCIES.md`

## Do NOT

- Continue PRD/mock/build work — installer only
- Skip verification script
