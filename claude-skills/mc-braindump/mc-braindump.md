---
name: mc-braindump
description: "Mission Control v3 — start a feature and run the full pipeline in one orchestrator session. Usage: /mc-braindump <describe feature and codebases>"
disable-model-invocation: true
argument-hint: [feature description + target codebase folder paths]
---

# Mission Control v3 — Braindump (continuous pipeline)

**You are the Orchestrator.** Capture the feature, then run **every pipeline stage through validate/e2e in this same session** without stopping for a new chat.

**MUST invoke:** `mission-control` skill + read `ORCHESTRATOR.md`.

**MUST read:** `AGENT-DATA-RULES.md`, `PIPELINE.md`, `JOURNAL-RULES.md`

## Raw input

$ARGUMENTS

## Continuous run rule

After each part completes, **immediately start the next part**. Do not emit session boundaries. Do not tell the user to start a new chat until the feature is `done` or you hit a BLOCKED stop condition.

## Part 0 — Setup check

1. Superpowers `brainstorming` available; else STOP → `SUPERPOWERS-SETUP.md`
2. `techStackStatus` established; else STOP → `/mc-init`

## Part A — Braindump

1. Derive `{slug}`; **AskQuestion** for target codebase paths if missing
2. Scaffold `features/{slug}/` if new; write `braindump.md`, journal, set `pipelineStage: explore`
3. Regenerate dashboard → **continue to Part B**

## Part B — Explore

Dispatch one `mc-explore` subagent per `targetCodebases[]`. When all done → `pipelineStage: clarify` → **continue to Part C**

## Part C — Clarify

Synthesize explore findings. **AskQuestion** one at a time (user answers in **this session**). Write clarify journal → `pipelineStage: prd` → **continue to Part D**

## Part D — PRD

Dispatch one `mc-prd` subagent. On DONE → `specStatus: approved`, `pipelineStage: mock` (or `plan` if tech-stack) → **continue to Part E**

## Part E — Mock (UX only; skip for tech-stack)

Dispatch one `mc-mock` subagent. On DONE → `layoutStatus: approved`, `pipelineStage: plan` → **continue to Part F**

## Part F — Plan

Dispatch one `mc-platform-plan` subagent (all platforms, one agent). On DONE → `pipelineStage: build` → **continue to Part G**

## Part G — Build

1. **AskQuestion** — e2e screenshot capture (once)
2. Invoke `subagent-driven-development` — all tasks in current phase
3. Phase-end e2e per `E2E-TOOLS.md`
4. → **continue to Part H** (do not stop for `/mc-validate` in a new chat)

## Part H — Validate

Run validation gate inline (see `/mc-validate` flow — orchestrator runs it, user does not start new session).

On pass:
- More phases? → Part F or G for next phase (**same session**)
- Feature complete? → `pipelineStage: done`, report success

## Stop conditions (only these)

- BLOCKED subagent
- User explicitly pauses
- Clarify waiting for AskQuestion answer (not a session end — continue when user replies)

## Do NOT

- Stop after any single part with "start a new session"
- Ask "should I continue?" between parts
- Let user run refine/layout/plan/build/validate as separate chats
- Skip journal files

## If interrupted mid-pipeline

User runs `/mc` later — resume from `pipelineStage` on disk with same continuous-run rules.
