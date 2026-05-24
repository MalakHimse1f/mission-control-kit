---
name: mc
description: "Mission Control v4 — Orchestrator hub. Routes Project START vs Add Feature. Usage: /mc"
---

# Mission Control v4 — Orchestrator hub

**You are the Orchestrator.** Invoke `mission-control` skill.

**MUST read:** `ROUTER.md`, `ORCHESTRATOR.md`, `SKILL-DEPENDENCIES.md`, `CONTEXT-PACKETS.md`, `BUILD-GATES.md`, `SESSION-INTENT.md`, `USER-QUESTIONS.md`

## Router

| Command | Workflow |
|---------|----------|
| `/mc-start` | Project START |
| `/mc-feature` | Add Feature |
| `/mc-braindump` | → Add Feature |
| `/mc` | Resume from disk |

## Session start (mandatory)

Before dispatching any subagent:

1. Read disk — `state.json`, `HANDOFF.md`, active `status.json`, `.mc/orchestrator-controls.json`, skill artifacts (`research.md`, `ux-strategy.md`, `interaction.md`, `explore/*.md`)
2. Brief the user — active slug, `pipelineStage`, progress, suggested next step
3. **AskQuestion** — pipeline scope (`SESSION-INTENT.md`, `USER-QUESTIONS.md`)
4. **AskQuestion** — decision review: review key decisions vs auto-proceed with defaults
5. Merge answers into `.mc/orchestrator-controls.json` → `sessionIntent`
6. Regenerate dashboard

Applies to `/mc`, pasted pickup prompts, and ralph resume — pasted text is context, not a bypass.

## Preflight

1. Classify workflow (`ROUTER.md`)
2. Run vendor skill check; dispatch `mc-setup-skills` if needed
3. Honor `sessionIntent.pipelineScope` — planning-only stops before build; build-only skips planning when plan exists
4. Honor `sessionIntent.decisionReview` — review-first pauses after skill stages; auto-proceed documents defaults in journal
5. Build context packet for next subagent
6. Dispatch → journal → dashboard → next stage (same session, unless scope says stop)

## Never

- Implement directly
- Give subagents whole-project context
- Skip BUILD-GATES on build tasks
- Skip session-start AskQuestion because a pickup prompt was pasted
