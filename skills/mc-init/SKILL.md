---
name: mc-init
description: "Mission Control — establish tech-stack context for a v5 project (run once before feature work). Usage: /mc-init"
---

# Mission Control — Init (v5 tech-stack setup)

**Run once** before starting feature work on a project. Dispatched from `/mc init`.

## Goal

Create the `tech-stack` feature in `control/v5/features/tech-stack/` so the pipeline has a typed
context object for the project's platforms and frameworks. After init the dashboard is live and the
user continues with
`/mc-feature` or `/mc`.

---

## Step 1 — Check if already done

Resolve `controlRoot`: the directory that contains `control/v5/`. Read
`control/v5/state.json` (use `readState` from `lib/v5/state.mjs`, or read the file directly).

If `state.json` already contains a feature entry with `featureType: "tech-stack"`, init has already
run. Tell the user:

> Tech-stack context is already established (`tech-stack` feature found in state.json).
> To work on a feature, run `/mc-feature` or `/mc`.

Stop here.

---

## Step 2 — Detect the stack

Import and call `detectStack({ projectRoot })` from `lib/v5/detect-stack.mjs`.

The function returns:

```js
{ likelyExisting: boolean, frameworks: string[], platforms: string[], signals: string[] }
```

Summarise the result in plain language to the user, for example:

> Detected: **Next.js + React** (web platform). Signals found: package.json.

If `frameworks` and `platforms` are both empty, say:

> No framework signals detected — looks like a blank slate.

---

## Step 3 — Ask one clarifying question

Ask via `AskUserQuestion` (this is a clarifying question, NOT a UX/UI/architecture decision — do
NOT route it through the dashboard):

**Question:** "Is this an existing codebase or starting from scratch?"

**Options:**

- `existing` — Existing codebase (code already here)
- `greenfield` — Starting from scratch

Pre-select `existing` when `detectStack().likelyExisting` is `true`.

Wait for the user's answer before continuing.

---

## Step 4 — Scaffold the tech-stack feature

Build a one-line description from the detected stack, for example:
`"Next.js + React web app (existing)"` or `"Greenfield mobile app (Expo + React Native)"`.

Run from the project root:

```bash
node lib/v5/cli/new-feature.mjs tech-stack --type tech-stack --description "<one-line stack summary>"
```

This creates `control/v5/features/tech-stack/` (with `status.json` and `decisions.json`) and
registers the entry in `control/v5/state.json`. Do NOT hand-write those files — always use this CLI.

`featureType: "tech-stack"` causes the pipeline to skip the `ux` and `ui` phases and start
directly at `architecture`.

---

## Step 5 — Greenfield only: scaffold initial features

Skip this step for existing codebases.

Ask the user (via `AskUserQuestion`, `allow_multiple: true`):

> What are the main things users will be able to do in this app? (Feature names only — we will flesh
> them out separately.)

For each feature the user names, scaffold it as a regular feature:

```bash
node lib/v5/cli/new-feature.mjs <slug> --description "<one-line description from user>"
```

Use short, URL-safe slugs (lowercase, hyphens). Do NOT write feature folders by hand.

---

## Step 6 — Open the dashboard

Call `openDashboard({ controlRoot })` from `lib/v5/auto-launch.mjs`:

```js
import { openDashboard } from './lib/v5/auto-launch.mjs';
const { url } = await openDashboard({ controlRoot });
```

Tell the user the URL verbatim:

> Dashboard is live at: {url}

The dashboard reflects live disk state — there is nothing to regenerate.

---

## Step 7 — Hand off

Tell the user:

```
Tech-stack context established.

Next steps:
  /mc-feature <description>   — scaffold and run the pipeline for a feature
  /mc                         — drive the pipeline for an existing feature
```

For greenfield projects, remind the user that each scaffolded feature starts at the `brainstorm`
stage and will flow through UX → UI → Architecture → Build. The tech-stack feature starts at
`architecture`.

---

## Do NOT

- Write `control/v5/state.json`, `status.json`, or `decisions.json` by hand — always use the CLI.
- Ask more than one clarifying question in Step 3 — if more context is needed, defer to `/mc-feature`.
- Use `AskUserQuestion` for UX/UI/architecture choices — those go through the dashboard decision flow.
- Advance any feature phase yourself — the pipeline (`/mc`) handles phase transitions via
  `lib/v5/decision-gate.mjs`.
- Create more than one tech-stack feature — there is exactly one per project.
