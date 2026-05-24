# Skill dependencies — Mission Control v4

Mission Control v4 **requires** external skill bundles for two workflows. Generic research or design prompts are **not** acceptable substitutes.

---

## Bundles

| Bundle | Source | Workflow | Install path (project) |
|--------|--------|----------|------------------------|
| **superpowers** | [obra/superpowers](https://github.com/obra/superpowers) | Both workflows | `.claude/skills/vendor/superpowers/` (+ mirrored to `.cursor/skills/vendor/superpowers/`) |
| **startup-skill** | [ferdinandobons/startup-skill](https://github.com/ferdinandobons/startup-skill) | Project START | `.claude/skills/vendor/startup-skill/` |
| **designer-skills** | [Owl-Listener/designer-skills](https://github.com/Owl-Listener/designer-skills) | Add Feature (design stages) | `.claude/skills/vendor/designer-skills/` |
| **prd-generator** | [jamesrochabrun/skills](https://github.com/jamesrochabrun/skills/tree/main/skills/prd-generator) | Add Feature (PRD stage) | `.claude/skills/vendor/prd-generator/` |

Pinned versions: `vendor/manifest.json` in the kit.

---

## Required invocations

### Superpowers (both workflows)

Bundled from [obra/superpowers](https://github.com/obra/superpowers) on install. Plugin install remains optional if you prefer marketplace updates.

| Stage | Required skills (minimum) |
|-------|---------------------------|
| Braindump / clarify | `brainstorming` |
| Plan | `writing-plans` |
| Build | `subagent-driven-development` |
| Validate (Add Feature) | `verification-before-completion` |

See `SUPERPOWERS-SETUP.md` for plugin fallback.

### Project START (`/mc-start`)

| Stage | Required skills (minimum) |
|-------|---------------------------|
| Market validation | `startup-design` (full or fast-track) |
| Competitors | `startup-competitors` when competitive landscape matters |
| Positioning | `startup-positioning` before platform/stack lock |
| Pitch (optional) | `startup-pitch` when raising or presenting externally |

### Add Feature (`/mc-feature`)

| Stage | Required skills (minimum) |
|-------|---------------------------|
| Research / clarify | `design-research` commands or skills |
| UX strategy | `ux-strategy` for IA, journeys, problem framing |
| Interaction | `interaction-design` for flows, states, errors |
| Interaction | `interaction-design` for flows, states, errors |
| Visual critique | `visual-critique` before mock approval |
| PRD | **`prd-generator`** (required) — auto-invoked by `mc-prd` subagent |

MC subagents (`mc-explore`, `mc-prd`, `mc-mock`, etc.) still run — vendor skills **inform** those stages; they do not replace disk artifacts.

**PRD stage:** orchestrator dispatches `mc-prd`; subagent **must invoke** `prd-generator` before writing `spec.md`. Generic PRD prompts are forbidden.

---

## Install policy (bundle first)

1. **Kit install** runs `scripts/bundle-vendor-skills.sh` → clones into kit `vendor/` and project `.claude/skills/vendor/`.
2. **Orchestrator preflight** runs `node scripts/check-vendor-skills.mjs {projectRoot} {workflow}`.
3. **If missing:** dispatch **`mc-setup-skills`** subtask before any explore/PRD/mock work.
4. **If install fails:** set `pipelineStage: blocked`, journal reason, ask user — do **not** silently continue.

### mc-setup-skills subtask

1. Run `bash mission-control-kit/scripts/bundle-vendor-skills.sh {projectRoot} project`
2. For Claude Code plugin users, also document plugin install commands from `vendor/manifest.json`
3. Re-run check script; journal `vendor-setup.md` with versions/commits
4. Return control to orchestrator

---

## Forbidden

- Skipping vendor skills because "the model can research anyway"
- Substituting ad-hoc prompts for `startup-design` or `design-research`
- Proceeding with Add Feature when `designer-skills` or `prd-generator` is missing
- Proceeding with Project START when `startup-skill` is missing
