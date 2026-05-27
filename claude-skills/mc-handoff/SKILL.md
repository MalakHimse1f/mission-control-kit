---
name: mc-handoff
description: "Mission Control — end-of-session handoff. Emits a pickup prompt for the active feature plus a brief chat summary. Usage: /mc-handoff"
---

# Mission Control — Session Handoff (v5)

**Purpose:** produce a pickup prompt and a short chat summary so a fresh agent (or
the user pasting into a new chat) can resume seamlessly. No files are written —
disk state is the resume mechanism.

---

## Step 1 — Identify the active feature

Read `control/v5/state.json` (via `readState` from `lib/v5/state.mjs`, or directly).
Use `state.activeFeature` as the `slug`. If `activeFeature` is null, check
`control/v5/features/` for the most-recently-modified `status.json` and use that slug.

---

## Step 2 — Read current status

Read `control/v5/features/{slug}/status.json`. Note the current `stage` and
`currentPhase`.

---

## Step 3 — Build the pickup prompt

Call `buildPickupPrompt({ slug, stage })` from `lib/v5/build-pickup-prompt.mjs`:

```js
import { buildPickupPrompt } from './lib/v5/build-pickup-prompt.mjs';
const prompt = buildPickupPrompt({ slug, stage });
```

Print the result in a fenced block labelled **"Pickup prompt — paste into next chat"**.

---

## Step 4 — Emit the chat summary

Invoke the `session-handoff` skill (subagent/helper) to produce a structured
chat summary covering:

- Where the session started
- Decisions locked and what shipped
- Key files for the next session
- Running state (processes, servers, branch)
- Verification commands
- Deferred items and open questions

---

## Step 5 — Tell the user

After the summary, say:

```
Disk state (always current):
  control/v5/features/{slug}/status.json
  control/v5/features/{slug}/decisions.json

Safe to /clear. In the next chat, paste the pickup prompt above, or run:
  /mc
```

---

## Do NOT

- Write any handoff file to disk — `buildPickupPrompt` output + disk state are the
  sole resume mechanism.
- Reference a static dashboard HTML file — use `openDashboard` from
  `lib/v5/auto-launch.mjs` to surface the live dashboard URL.
- Read from the v4 control root layout (`docs/superpowers/...`) — v5 state lives
  under `control/v5/`.
