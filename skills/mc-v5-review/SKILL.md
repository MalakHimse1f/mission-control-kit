---
name: mc-v5-review
description: "Mission Control v5 — auto-launch the dashboard for review when a visual artifact is created or the user asks to see something. Orchestrator-internal; not user-invoked."
---

# Mission Control v5 — Auto-Launch Dashboard for Review

**Audience:** the v5 orchestrator. Not a slash command — the user never types `/mc-v5-review`. The orchestrator decides when to call it.

**Goal:** When a dashboard-worthy moment happens, ensure the v5 dashboard server is running, open the user's browser to the relevant page, and tell the user in chat with the URL.

## Trigger events (from diagram 05)

Invoke this skill in any of these four situations:

1. **A subagent creates a visual artifact** — a UX flow, architecture diagram, UI option set, mock, or wireframe HTML lands under `control/v5/features/{slug}/`.
2. **The user says "I want to review" / "show me" / "open the dashboard"** — any explicit request to see current state.
3. **Brainstorming reaches a decision point** — when a UX/UI/architecture question requires user choice rather than chat-only resolution.
4. **Research completes — patterns ready** — a research subagent finishes and patterns are queued for transformation into a UX flow diagram.

## What this skill does

Call `openDashboard({ slug, anchor, controlRoot })` from `lib/v5/auto-launch.mjs`. It:

1. Calls `ensureRunning({ controlRoot })` (from `lib/v5/launch-server.mjs`) — spawns the v5 dashboard server if not already up.
2. Builds the target URL:
   - feature page →  `${url}/feature/${slug}`
   - decision focus → append `#${anchor}` (e.g. `#decisions`)
   - general review → `${url}/`
3. Runs `open` (macOS), `xdg-open` (Linux), or `start` (Windows) on the URL.
4. Returns `{ url, port, alreadyRunning }`.

## How to call it (one-liner from the orchestrator)

```bash
node -e "import('./lib/v5/auto-launch.mjs').then(m => m.openDashboard({slug: 'user-onboarding', anchor: 'decisions', controlRoot: process.cwd() + '/control'}).then(r => console.log(JSON.stringify(r))))"
```

Or programmatically when the orchestrator already has a Node context:

```js
import { openDashboard } from './lib/v5/auto-launch.mjs';
const { url, alreadyRunning } = await openDashboard({
  slug: 'user-onboarding',
  anchor: 'decisions',
  controlRoot: '/abs/path/to/control',
});
```

## Choosing slug and anchor

| Trigger                                  | slug          | anchor       |
|------------------------------------------|---------------|--------------|
| Subagent produced a feature artifact     | feature slug  | matching tab (`ux`, `ui`, `architecture`) or `decisions` |
| User said "show me X"                    | feature slug if scoped, otherwise omit | omit unless they referenced a section |
| Brainstorming decision point             | feature slug  | `decisions`  |
| Research completed → patterns ready      | feature slug  | `ux`         |
| General "open the dashboard"             | omit          | omit         |

## After opening — chat back to the user

Send a short confirmation that includes the URL. Match this shape:

> I've created a UX flow diagram for **user-onboarding**. Opening the dashboard for you to review and make selections.
> → http://127.0.0.1:9470/feature/user-onboarding#decisions

If the server was already running (`alreadyRunning: true`), still print the URL — the user may have closed the tab.

## Failure handling

If `openDashboard` rejects:

- Catch the error and chat back: `Couldn't launch dashboard: <error message>`.
- Include the intended URL if you can derive one — the user may be able to navigate manually.
- Do not retry silently. Surface the failure so the user can recover.

## Do NOT

- Do not call this skill on every subagent dispatch — only on the four trigger events above.
- Do not block the orchestrator on browser readiness; `openDashboard` returns once the spawn is issued, not when the page paints.
- Do not assume the dashboard server is on a fixed port; always read `port` / `url` from the return value of `openDashboard`.
