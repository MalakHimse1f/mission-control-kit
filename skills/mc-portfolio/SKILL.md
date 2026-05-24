---
name: mc-portfolio
description: "Mission Control stage 2.5 — holistic review of all approved specs. Usage: /mc-portfolio"
---

# Mission Control — Stage 2.5: Portfolio Review

**MUST invoke:** `mission-control` skill, then **`spec-portfolio-review`** skill.

**MUST read:** `docs/superpowers/control/AGENT-DATA-RULES.md` — inventory must include **every** feature on disk; merge `state.json`, never drop slugs from the portfolio.

## This session only

1. List **all** folders under `docs/superpowers/control/features/*/` (exclude `_template`). Read every approved `spec.md` — not only the slug from chat context.
2. Cross-check with `docs/superpowers/specs/` and `IMPLEMENTATION_RULES.md`.
3. Write `docs/superpowers/control/SPEC-PORTFOLIO-REVIEW.md`.
4. Ask user to approve **build order** before any planning — use `AskQuestion` (Cursor) or `AskUserQuestion` (Claude Code). See `docs/superpowers/control/USER-QUESTIONS.md`.
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

## After portfolio review approved

```
Portfolio review approved.

Build order saved to state.json: [list slugs in order]
Open docs/superpowers/control/dashboard.html — **Build order** panel shows numbered sequence.

Continue in this session — orchestrator resumes the active feature pipeline per ORCHESTRATOR.md.
Optional: /mc-handoff
```
