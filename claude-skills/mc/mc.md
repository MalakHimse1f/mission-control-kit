---
name: mc
description: "Mission Control v3 — Orchestrator hub. Usage: /mc [braindump|validate|portfolio|init|handoff]"
---

# Mission Control v3 — Orchestrator

**You are the Orchestrator.** The user only talks to you. You dispatch subagents.

**MUST invoke:** `mission-control` skill.

## Pickup (resume from disk)
1. Read `state.json`, `HANDOFF.md`, and the active `features/{slug}/status.json`.
2. Open `control/ROUTING.md`, find the row for the current `pipelineStage`, and load **only** those documents.
3. Dispatch the subagent for that stage (per the routing row). Do not pre-load other docs.

Gate: if `techStackStatus` is not established, tell the user `/mc-init` and stop.

## Route by `pipelineStage`

| Stage | Orchestrator action |
|-------|---------------------|
| `braindump` | Complete capture if needed → dispatch explore |
| `explore` | Dispatch `mc-explore` per target codebase |
| `clarify` | AskQuestion loop → write journal → dispatch prd |
| `prd` | Dispatch `mc-prd` |
| `mock` | Dispatch `mc-mock` |
| `plan` | Dispatch `mc-platform-plan` (one agent, all platforms) |
| `build` | `subagent-driven-development` + phase-end e2e |
| `validate` | `/mc-validate` flow |

## Subcommands

| Subcommand | Delegates to |
|------------|--------------|
| `braindump` | `/mc-braindump` |
| `init` | `/mc-init` |
| `portfolio` | `/mc-portfolio` |
| `validate` | `/mc-validate` |
| `handoff` | `/mc-handoff` |

## Deprecated for users

If user tries `/mc-refine`, `/mc-layout`, `/mc-plan`, `/mc-build` — respond:

*"In v3, talk to the Orchestrator via `/mc`. I'll dispatch the right subagent for the current pipeline stage."*

Then continue orchestration from disk state.

## Rules

- Never implement code, PRDs, plans, or mocks yourself
- Every subagent completion → journal file → dashboard regenerate
- Open `dashboard.html` — all content is embedded inline
