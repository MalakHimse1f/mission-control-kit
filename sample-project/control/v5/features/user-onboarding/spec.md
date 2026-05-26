# User Onboarding — Spec

## Overview
Replace the current "drop into an empty dashboard" first-run experience with a guided three-step setup followed by an in-context product tour. Goal: get a new user to their first meaningful action within 90 seconds of signing up.

## Goals
- Reduce 7-day churn for newly created accounts by 20%.
- Get 80% of new users to complete the setup wizard.
- Get 60% of new users to engage with at least three coachmarks.

## Non-goals
- Onboarding for users invited to an existing workspace (covered separately).
- Resurrection flow for dormant users.
- Mobile app onboarding (this spec is web only).

## Flow
1. **Welcome step** — collect the user's role and team size.
2. **Workspace step** — name the workspace, optionally invite teammates by email.
3. **First-action step** — pick one of three starter actions (create doc, import data, browse templates).
4. **Coachmark tour** — five contextual tooltips covering the most common navigation paths.

## UX decisions (locked)
- First impression: **three-step setup wizard** (chosen over empty dashboard or sample data).
- Tour delivery: **coachmarks overlaying real UI** (chosen over modal video or scripted scenario).

## UI decisions (locked)
- Wizard style: **full-screen step-by-step with progress bar**.
- Coachmark style: **soft glow around target with floating tooltip** (no dark scrim).

## Architecture decisions (locked)
- Progress state: **user row in primary DB** — `onboarding_step`, `onboarding_completed_at` columns.
- Tour engine: **server-driven script delivered as JSON** so we can iterate without shipping client code.

## Success metrics
- Setup completion rate (target: 80%).
- Coachmark engagement rate (target: 60% complete ≥3).
- 7-day retention delta vs control (target: +20%).
- Time-to-first-meaningful-action (target: < 90s p50).

## Open questions
- None — all decisions locked. Ready for build.
