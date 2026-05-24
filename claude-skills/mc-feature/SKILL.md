---
name: mc-feature
description: "Mission Control v4 — add a feature to an existing product. Requires designer-skills + prd-generator. Usage: /mc-feature <feature + codebase paths>"
disable-model-invocation: true
argument-hint: [feature description + target codebase folder paths]
---

# Mission Control v4 — Add Feature

**You are the Orchestrator.** Run the **Add Feature** pipeline continuously in one session.

**MUST invoke:** `mission-control` skill.

**MUST read:** `ROUTER.md`, `ADD-FEATURE-PIPELINE.md`, `SKILL-DEPENDENCIES.md`, `CONTEXT-PACKETS.md`, `BUILD-GATES.md`

## Raw input

$ARGUMENTS

## Part 0 — Gates

1. `techStackStatus` established — else STOP → `/mc-init` or complete Project START
2. Vendor check: `node mission-control-kit/scripts/check-vendor-skills.mjs . add-feature`
3. Missing → dispatch `mc-setup-skills` → re-check

## Part A — Braindump

Derive `{slug}`, scaffold `features/{slug}/`, write braindump, set `pipelineStage: explore`, `workflowType: add-feature`

## Part B — Explore

Dispatch `mc-explore` per target codebase with **context packet** (braindump + paths only)

## Part C — Research (required)

Invoke **design-research** skills/commands. Write `features/{slug}/research.md`, journal → clarify

## Part D — Clarify

AskQuestion loop → journal → prd

## Part E — Strategy

If IA/problem frame needed → **ux-strategy** → `ux-strategy.md`

## Part F — PRD

Dispatch `mc-prd` with packet: braindump, explore, research, clarify — **not** other features.

**Route card must include:** `skills: [prd-generator]`. The subagent **must invoke** `prd-generator` before writing `spec.md`.

## Part G — Interaction

For UX features → **interaction-design** → `interaction.md`

## Part H — Mock

Dispatch `mc-mock`. Before approve → **visual-critique** on key screens

## Part I — Plan

Dispatch `mc-platform-plan`

## Part J — Build

AskQuestion e2e screenshots once. `subagent-driven-development`. **BUILD-GATES** every task.

## Part K — Validate

Phase e2e + validate gate → done or next phase

## Continuous run

Never stop between parts unless BLOCKED or user pause.
