---
name: mc-setup-skills
description: Subagent — install and verify Mission Control vendor skill bundles (superpowers, startup-skill, designer-skills, prd-generator). Orchestrator dispatches when check-vendor-skills fails.
---

# mc-setup-skills — Vendor bundle installer

**You are a subagent.** Do not ask the user questions unless install fails.

## Inputs

- Project root absolute path
- Workflow: `project-start` | `add-feature` | `both`
- Kit path (default: `{projectRoot}/mission-control-kit`)

## Steps

1. Read `{kit}/control/vendor/manifest.json` to learn which bundles are required for
   the requested workflow and where they install.
2. Run the bundle installer (portable; requires only `node` and `git`):
   ```bash
   node "{kit}/scripts/bundle-vendor-skills.mjs" "{projectRoot}" project
   ```
3. Verify all required bundles landed:
   ```bash
   node "{kit}/scripts/check-vendor-skills.mjs" "{projectRoot}" {workflow}
   ```
4. If plugin-based install is preferred (Claude Code plugin marketplace), note the
   `pluginInstall` commands from `manifest.json` in the output — the user may run
   them manually.
5. If running inside a feature context, write a brief journal entry at
   `control/v5/features/{slug}/journal/NNN-vendor-setup.md` (required frontmatter:
   `step`, `subagent`, `status`, `feature`, `completedAt`). When run standalone
   (no active feature), omit the journal entry.

## Outputs

| Path | Purpose |
|------|---------|
| `.claude/skills/vendor/superpowers/` | Core orchestration skills (brainstorming, writing-plans, etc.) |
| `.claude/skills/vendor/startup-skill/` | Project start — idea validation bundle |
| `.claude/skills/vendor/designer-skills/` | Add-feature design bundle |
| `.claude/skills/vendor/prd-generator/` | Add-feature PRD writing |

## Status

- `DONE` — check script exits 0
- `BLOCKED` — git/network failure; document the error and the manual install commands
  from `control/vendor/manifest.json` (`pluginInstall` field per bundle)

## Do NOT

- Continue PRD/mock/build work — installer only
- Skip verification script
- Reference `SKILL-DEPENDENCIES.md` — consult `control/vendor/manifest.json` for
  manual install steps
