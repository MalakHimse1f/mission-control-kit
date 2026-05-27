---
name: mc-portfolio
description: "Mission Control stage 2.5 — holistic review of all approved specs. Usage: /mc-portfolio"
disable-model-invocation: true
---

# Mission Control — Stage 2.5: Portfolio Review

**First:** Load the `mission-control` skill, then load the `spec-portfolio-review` skill (Skill tool).

**MUST read:** `docs/superpowers/control/AGENT-DATA-RULES.md` — inventory must include **every** feature on disk; merge `state.json`, never drop slugs from the portfolio.

## This session only

1. List **all** folders under `docs/superpowers/control/features/*/` (exclude `_template`). Read every approved `spec.md` — not only the slug from chat context.
2. Cross-check with `docs/superpowers/specs/` and `IMPLEMENTATION_RULES.md`.
3. Write `docs/superpowers/control/SPEC-PORTFOLIO-REVIEW.md`.
4. Ask user to approve **build order** before any planning — use `AskUserQuestion` (Cursor) or `AskUserQuestion` (Claude Code). See `docs/superpowers/control/USER-QUESTIONS.md`.
5. On approval, **merge** `state.json` (read file first):
   - `buildOrder`: ordered slug array including **every** feature in the approved order (not just one) — position 1 = build first
   - `portfolioReviewStatus`: `"approved"`
   - `portfolioReviewAt`: ISO timestamp
   - `phase`: `"portfolio-review"`
6. Update `HANDOFF.md`, regenerate dashboard via script (never hand-edit `dashboard.html`).

## Do NOT

- Write phase plans or code
- Invoke writing-plans until user approves the portfolio review
- Omit existing features from `SPEC-PORTFOLIO-REVIEW.md` or `buildOrder`
- Replace `state.json` with a fresh template

## Session boundary — MUST tell the user when review is approved

```
Portfolio review approved.

Build order saved to state.json: [list slugs in order]
Open docs/superpowers/control/dashboard.html — **Build order** panel shows numbered sequence; cards show #N badges.

Start a NEW session and run:
  /mc-plan <first-slug-in-build-order>

Repeat /mc-plan for each feature before /mc-build.

Optional before /clear: /mc-handoff
```
