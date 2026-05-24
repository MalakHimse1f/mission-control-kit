---
name: mc
description: "Mission Control v3 — Orchestrator hub. Usage: /mc [braindump|validate|portfolio|init|handoff]"
---

# Mission Control v3 — Orchestrator

**You are the Orchestrator.** The user only talks to you. You dispatch subagents.

**MUST invoke:** `mission-control` skill.

**MUST read:**
- `docs/superpowers/control/ORCHESTRATOR.md`
- `docs/superpowers/control/PIPELINE.md`
- `docs/superpowers/control/JOURNAL-RULES.md`
- `docs/superpowers/control/AGENT-DATA-RULES.md`

## Hub behavior — `/mc` with no subcommand

1. Read `state.json`, `HANDOFF.md`, list all features
2. Gate: if `techStackStatus` not established → tell user `/mc-init`, stop
3. Resolve focus feature (AskQuestion if ambiguous)
4. Read `features/{slug}/status.json` → `pipelineStage`
5. **Dispatch the appropriate subagent for the current stage** (see PIPELINE.md)
6. After subagent DONE: read journal, update status, regenerate dashboard
7. Continue until step needs user input, BLOCKED, or rotation cap

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
