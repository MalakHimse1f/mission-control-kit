---
name: mc-portfolio
description: "Mission Control v5 — cross-feature portfolio review. Dispatches spec-portfolio-review subagent, surfaces the recommended build order, asks user to approve, then persists order by reordering control/v5/state.json features[] and opens the dashboard. Usage: /mc-portfolio"
---

# Mission Control v5 — Portfolio Review

**You are the v5 portfolio orchestrator.** Disk is the source of truth. Your job is to orchestrate a cross-feature review, surface the recommended build order, get user approval, and persist the result.

## When to invoke

- Two or more features exist under `control/v5/features/`
- User asks for "portfolio review", "review all specs", or "holistic spec review"
- One spec: suggest `/mc braindump` or `/mc feature` instead

## Session start (mandatory)

1. List all directories under `control/v5/features/` (exclude `_template`).
2. Read `control/v5/state.json` via `readState` from `lib/v5/state.mjs` — note current `features[]` order and `activeFeature`.
3. Confirm at least two features are present before proceeding. If only one, stop and tell the user.

## Step 1 — Dispatch spec-portfolio-review subagent

Dispatch the `spec-portfolio-review` skill. Provide it:

- The list of feature slugs found in `control/v5/features/`
- The path `control/v5/` as the context root
- Instruction: write `control/v5/SPEC-PORTFOLIO-REVIEW.md`

Wait for the subagent to complete and confirm the file was written.

## Step 2 — Present the recommended build order (clarifying question)

Read `control/v5/SPEC-PORTFOLIO-REVIEW.md` and extract the recommended build order from it.

Ask the user to approve or adjust the order. This is a **clarifying question** (scope/sequencing), not a UX/UI/architecture decision — use `AskUserQuestion` (Claude Code) or stop and ask directly (Cursor). Present the slugs in the recommended order and allow the user to reorder them.

Example ask:

> The portfolio review recommends this build order:
> 1. `<slug-a>` — <rationale>
> 2. `<slug-b>` — <rationale>
>
> Do you approve this order, or would you like to adjust it?

Do NOT proceed past this point until the user responds.

## Step 3 — Persist the approved order

Once the user approves (or provides a revised order):

1. Read the current state via `readState` from `lib/v5/state.mjs`.
2. Reorder the `features[]` array to match the approved build sequence — position 0 = build first. Do NOT add or remove slugs; only reorder. Every slug already in `features[]` must remain.
3. Write back via `writeState(state, { controlRoot })` from `lib/v5/state.mjs`. The `controlRoot` is the project root (the directory containing `control/v5/`).

## Step 4 — Open the dashboard

Call `openDashboard({ controlRoot })` from `lib/v5/auto-launch.mjs`.

Tell the user verbatim (substituting the URL):

> Portfolio review complete. Build order saved — features[] in state.json now reflects the approved sequence (position 0 = build first).
> Dashboard opened at: {url}

## Data rules

- Mutate `state.json` only via `lib/v5/state.mjs` (`readState` / `writeState`). Never write raw JSON.
- `controlRoot` is the PROJECT ROOT (the directory containing `control/v5/`), never `control/v5/` itself.
- Do NOT touch `decisions.json` or any feature's `status.json` — this skill is read-only for feature data.
- Never drop slugs from `features[]`. If a slug is in `state.json` but not returned by the subagent, keep it at the end of the reordered array.

## Never

- Write code, phase plans, or specs
- Invoke `mc-decide` from this skill — portfolio review raises no UX/UI/architecture decisions
- Skip the user approval step (Step 2) — the order must be confirmed before persisting
- Hand-edit `decisions.json` or fragment HTML
- Skip `openDashboard` — the user must be able to see the result in the dashboard
