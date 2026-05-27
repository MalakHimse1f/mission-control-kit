---
name: spec-portfolio-review
description: Reviews all approved feature specs in mission control holistically for overlap, contradictions, dependencies, and build order. Use when the user has two or more specs in control/features/, asks for a portfolio review, holistic spec review, or before planning multiple features. Writes SPEC-PORTFOLIO-REVIEW.md in the control root.
user-invocable: false
---

# Spec Portfolio Review

Cross-feature review before planning. One spec = use brainstorming instead.

## Paths (customize per project)

| Setting | Default |
|---------|---------|
| **CONTROL_ROOT** | `docs/superpowers/control/` |
| **ROADMAP_SPECS** | `docs/superpowers/specs/` |
| **RULES** | `docs/superpowers/IMPLEMENTATION_RULES.md` |

## When to invoke

- 2+ features with `specStatus: "approved"`
- "review all specs", "portfolio review", "holistic spec review"

## Read

All `{CONTROL_ROOT}/features/{slug}/spec.md` (approved), status.json files, roadmap specs, RULES.

**Portfolio rule:** Feature inventory and `buildOrder` must include **every** slug under `features/` (exclude `_template`). See `{CONTROL_ROOT}AGENT-DATA-RULES.md`. Never write a review that drops existing features because chat context only mentioned one.

## Checklist

1. Overlap 2. Contradictions 3. **Dependencies** (blocks / requires / shares data) 4. **Build order** (sequence from dependency graph) 5. Roadmap alignment 6. Open questions 7. Gaps

**Build order is the primary deliverable.** Analyze each spec pair for: shared auth, data models, navigation entry points, API contracts, and "Feature B assumes Feature A exists" language. Produce a **numbered recommended order** with one-line rationale per position.

## Output

Write `{CONTROL_ROOT}/SPEC-PORTFOLIO-REVIEW.md` with: Summary, Feature inventory, Findings, **Recommended build order** (numbered list with dependency rationale), Decisions needed, Next action.

## After

1. Ask user to approve **build order** before planning — use `AskQuestion` (Cursor) or `AskUserQuestion` (Claude Code). See `{CONTROL_ROOT}USER-QUESTIONS.md`. Present slugs in recommended order; allow reorder if they pick a different sequence.
2. On approval, persist to `{CONTROL_ROOT}/state.json` (**read → merge → write**):
   - `buildOrder`: array of feature slugs in approved order (e.g. `["auth", "dashboard"]`)
   - `portfolioReviewStatus`: `"approved"`
   - `portfolioReviewAt`: ISO timestamp
   - `phase`: `"portfolio-review"` (until planning starts)
3. Update `HANDOFF.md`, regenerate dashboard (`node {CONTROL_ROOT}scripts/generate-dashboard.mjs`).

**HARD GATE:** No writing-plans until user acknowledges review (unless only one spec).
