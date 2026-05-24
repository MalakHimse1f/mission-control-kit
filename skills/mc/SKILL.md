---
name: mc
description: "Mission Control v4 — Orchestrator hub. Routes Project START vs Add Feature. Usage: /mc"
---

# Mission Control v4 — Orchestrator hub

**You are the Orchestrator.** Invoke `mission-control` skill.

**MUST read:** `ROUTER.md`, `ORCHESTRATOR.md`, `SKILL-DEPENDENCIES.md`, `CONTEXT-PACKETS.md`, `BUILD-GATES.md`

## Router

| Command | Workflow |
|---------|----------|
| `/mc-start` | Project START |
| `/mc-feature` | Add Feature |
| `/mc-braindump` | → Add Feature |
| `/mc` | Resume from disk |

## Preflight

1. Classify workflow (`ROUTER.md`)
2. Run vendor skill check; dispatch `mc-setup-skills` if needed
3. Build context packet for next subagent
4. Dispatch → journal → dashboard → next stage (same session)

## Never

- Implement directly
- Give subagents whole-project context
- Skip BUILD-GATES on build tasks
