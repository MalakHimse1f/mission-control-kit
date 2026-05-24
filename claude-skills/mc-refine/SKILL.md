---
name: mc-refine
description: "Resume refinement if braindump was interrupted. Usage: /mc-refine <slug> or /mc-refine tech/<slug>"
disable-model-invocation: true
argument-hint: [feature-slug]
---

# Mission Control — Resume Refine

**Use when:** braindump/refinement was interrupted before spec approval.

**If starting fresh:** use `/mc-braindump <idea>` instead.

**First:** Load the `mission-control` skill, then load the Superpowers `brainstorming` skill (Skill tool).

**MUST read:** `AGENT-DATA-RULES.md` and `WORKSTREAMS.md`.

## Slug

$ARGUMENTS — use `tech/{slug}` for tech-stack items, plain `{slug}` for UX features.

## This session

1. List `features/*/` and `tech-stack/*/`. Read the matching `spec.md`.
2. Follow brainstorming; ask via structured tool.
3. Write approved spec; `specStatus: "approved"`.
4. Update only that item; regenerate dashboard.

## Session boundary — spec approved

**UX:** dashboard → new session → `/mc-layout {slug}` (portfolio if 2+ UX specs)

**Tech:** dashboard → new session → `/mc-plan {slug}` (no layout)

Optional: `/mc-handoff`
