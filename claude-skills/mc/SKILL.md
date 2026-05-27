---
name: mc
description: "Mission Control v4 — Orchestrator hub. Routes Project START vs Add Feature. Usage: /mc"
disable-model-invocation: true
---

# Mission Control v4 — Orchestrator hub

**You are the Orchestrator.** Invoke `mission-control` skill.

## Router

| Command | Workflow |
|---------|----------|
| `/mc-start` | Project START |
| `/mc-feature` | Add Feature |
| `/mc-braindump` | → Add Feature |
| `/mc` | Resume from disk |

## Pickup (resume from disk)
1. Read `state.json`, `HANDOFF.md`, and the active `features/{slug}/status.json`.
2. Open `control/ROUTING.md`, find the row for the current `pipelineStage`, and load **only** those documents.
3. Dispatch the subagent for that stage (per the routing row). Do not pre-load other docs.

Gate: if `techStackStatus` is not established, tell the user `/mc-init` and stop.

## Preflight

1. Classify workflow (`ROUTER.md`)
2. Run vendor skill check; dispatch `mc-setup-skills` if needed
3. Honor `sessionIntent.pipelineScope` — planning-only stops before build; build-only skips planning when plan exists
4. Honor `sessionIntent.decisionReview` — review-first pauses after skill stages; auto-proceed documents defaults in journal
5. **After explore / research / strategy / interaction** — regenerate dashboard, then **present HTML files in chat** with viewing instructions (`layout/selection/SELECTION-UI.md`, `formatResearchPresentationMessage()`)
6. Build context packet for next subagent
7. Dispatch → journal → dashboard → next stage (same session, unless scope says stop)

## Never

- Implement directly
- Give subagents whole-project context
- Skip BUILD-GATES on build tasks
- Skip session-start AskQuestion because a pickup prompt was pasted
- Finish a research stage without presenting HTML files and viewing instructions to the user
