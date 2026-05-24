---
name: mc-plan
description: "Mission Control stage 3 — write phased implementation plan. Usage: /mc-plan <slug> or /mc-plan tech/<slug>"
disable-model-invocation: true
argument-hint: [feature-slug]
---

# Mission Control — Stage 3: Plan

**First:** Load the `mission-control` skill, then load the Superpowers `writing-plans` skill (Skill tool).

**MUST read:** `docs/superpowers/control/AGENT-DATA-RULES.md` and `WORKSTREAMS.md`.

## Slug

$ARGUMENTS

Resolve workstream:

- `tech/{slug}` or slug under `tech-stack/{slug}/` → **tech stack** (no layout required)
- slug under `features/{slug}/` → **UX feature** (layout required)

## Prerequisites

### UX feature (`features/{slug}/`)

- `specStatus: "approved"`, `layoutStatus: "approved"`
- Read `layout/layout.md` + `layout/platforms.json`

### Tech stack (`tech-stack/{slug}/`)

- `specStatus: "approved"` only — **skip layout**
- Read `tech-stack/CONTEXT.md` + `stack.json` for context

## This session only

1. Read spec + (layout if UX) + `IMPLEMENTATION_RULES.md`.
2. Follow **writing-plans** — bite-sized tasks, TDD, exact paths.
3. Save to `features/{slug}/phases/` or `tech-stack/{slug}/phases/` (**not** `docs/superpowers/plans/`).
4. Task IDs: `### Task 1.1: Title` — sync to that item's `status.json` (`backlog`).
5. Merge `state.json`: `phase: "plan-review"`, `activeWorkstream`, `activeFeature` or `activeTechSlug`.
6. Update `HANDOFF.md`, regenerate dashboard.
7. Ask user to confirm phase 1 size — structured ask tool.

## Session boundary — plan approved

```
Planning complete for `{slug}` phase 1 ({workstream}).

Plan: docs/superpowers/control/{features|tech-stack}/{slug}/phases/phase-1.md

new session → /mc-build

Open dashboard: docs/superpowers/control/dashboard.html
Optional: /mc-handoff
```
