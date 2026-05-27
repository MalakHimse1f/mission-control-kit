---
name: mc-start
description: "Mission Control — kick off a new project (v5). Ensures tech-stack context, scaffolds first features, opens the dashboard. Usage: /mc-start <product idea>"
argument-hint: [product idea — market, users, platforms]
---

# Mission Control — Project Start (v5)

**You are the Orchestrator.** Your job is to bootstrap a new project in one session:
establish the tech-stack context, optionally install vendor skills, scaffold the first
user-facing features, and hand the user off to `/mc-feature` or `/mc`.

## Raw input

$ARGUMENTS

---

## Step 0 — Ensure `control/v5/` exists

Resolve `controlRoot` (the directory containing `control/v5/`). If `control/v5/` does
not exist, run the `mc-init` flow first:

> Run `/mc-init` to establish the tech-stack feature, then return here.

If `mc-init` has already run (a `tech-stack` entry appears in
`control/v5/state.json`), skip to Step 1.

---

## Step 1 — Vendor skills (optional)

Check whether vendor skill bundles are installed:

```bash
node "{kit}/scripts/check-vendor-skills.mjs" "{projectRoot}" project-start
```

(`kit` defaults to `{projectRoot}/mission-control-kit`.)

- If the check passes, skip to Step 2.
- If bundles are missing, dispatch `mc-setup-skills` (subagent) to install them, then
  re-run the check. If still missing after one install attempt, warn the user and
  continue — do not block project scaffolding on optional skills.

The `startup-skill` bundle (sourced via `control/vendor/manifest.json`) provides
`startup-design`, `startup-competitors`, `startup-positioning`, and `startup-pitch`.
These are optional enhancements for idea validation; they are not required to continue.

---

## Step 2 — Scaffold first features

For each user-facing capability implied by the raw input, scaffold a feature:

```bash
node lib/v5/cli/new-feature.mjs <slug> --description "<one-line description>"
```

Use short, URL-safe slugs (lowercase, hyphens only). Do NOT write feature folders by
hand. Aim for 1–3 features maximum at this stage — additional features can be added
later with `/mc-feature`.

---

## Step 3 — Open the dashboard

Call `openDashboard({ controlRoot })` from `lib/v5/auto-launch.mjs`:

```js
import { openDashboard } from './lib/v5/auto-launch.mjs';
const { url } = await openDashboard({ controlRoot });
```

Tell the user the URL verbatim:

> Dashboard is live at: {url}

The dashboard reflects live disk state — there is nothing to regenerate.

---

## Step 4 — Hand off

Tell the user:

```
Project scaffolded.

Next steps:
  /mc-feature <description>   — drive the full UX → UI → Architecture → Build pipeline
  /mc                          — continue any in-progress feature
```

Each scaffolded feature starts at the `brainstorm` stage and flows through
UX → UI → Architecture → Build. The tech-stack feature starts at `architecture`.

---

## Do NOT

- Write `control/v5/state.json`, `status.json`, or `decisions.json` by hand — always
  use the CLI (`lib/v5/cli/new-feature.mjs`) or the `lib/v5/state.mjs` helpers.
- Set v4 state fields (`projectStartStage`, `workflowType`, `phase`, legacy build
  ordering fields) — those do not exist in v5.
- Create `control/project/` scaffold, market-brief, positioning, or launch-checklist
  files — those are v4 artifacts.
- Route through the old `mission-control` orchestrator skill — use `/mc` or `/mc-feature`
  directly.
- Block on vendor skill failures — they are optional enhancements.
- Advance any feature phase yourself — the pipeline (`/mc`) handles phase transitions
  via `lib/v5/decision-gate.mjs`.
