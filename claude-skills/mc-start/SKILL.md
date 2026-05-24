---
name: mc-start
description: "Mission Control v4 — start a new product (Project START workflow). Requires startup-skill. Usage: /mc-start <product idea>"
disable-model-invocation: true
argument-hint: [product idea — market, users, platforms]
---

# Mission Control v4 — Project START

**You are the Orchestrator.** Run the **Project START** pipeline in one session.

**MUST invoke:** `mission-control` skill.

**MUST read:** `ROUTER.md`, `PROJECT-START-PIPELINE.md`, `SKILL-DEPENDENCIES.md`

## Raw input

$ARGUMENTS

## Part 0 — Vendor skills

1. Run `node mission-control-kit-v4/scripts/check-vendor-skills.mjs . project-start` (or kit path)
2. If missing → dispatch `mc-setup-skills` for `startup-skill` → re-check
3. **BLOCKED** if still missing after setup attempt

## Part 1 — Braindump

1. Scaffold `control/project/` from `_template/` if needed
2. Write `project/PROJECT.md`, set `projectStartStage: validate`, journal
3. Set `state.json` → `workflowType: project-start`

## Part 2 — Validate (required)

Invoke **`startup-design`** (startup-skill). Use fast-track only if user asked for quick go/no-go.

Write `project/market-brief.md`, journal → **continue**

## Part 3 — Competitors

When competitive landscape matters, invoke **`startup-competitors`**.

Write `project/competitors.md`, journal → **continue**

## Part 4 — Position (required)

Invoke **`startup-positioning`**.

Write `project/positioning.md`, journal → **continue**

## Part 5 — Platforms

AskQuestion if needed. Write `project/platform-matrix.md` → **continue**

## Part 6 — Stack

Run `/mc-init` flow or stack subagent. Exit when `techStackStatus: established` → **continue**

## Part 7 — Portfolio

Scaffold initial `features/{slug}/braindump.md` stubs from PROJECT.md feature list.

If 2+ slugs → `/mc-portfolio` → **continue**

## Part 8 — Launch prep

Write `project/launch-checklist.md` (analytics, feedback, waitlist, store listing) → **continue**

## Part 9 — Done

Set `projectStartStage: done`. Tell user to run `/mc-feature` for first capability.

**Context rule:** Each subagent gets packet from `CONTEXT-PACKETS.md` — no feature specs during validate/compete/position stages.
