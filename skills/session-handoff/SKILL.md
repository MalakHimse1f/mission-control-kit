---
name: session-handoff
description: Use when the user says "session handoff", "wrap up session", "hand off", "handoff summary", or wants a structured end-of-session summary before clearing context. Produces a chat-only handoff covering decisions, shipped changes, key files, running state, verification steps, deferrals, and open questions so a fresh agent can continue seamlessly.
user-invocable: false
---

# Session Handoff (v5)

Chat-only synthesis before `/clear`. Persistent state lives in
`control/v5/features/{slug}/status.json` and `control/v5/features/{slug}/decisions.json`.
The pickup prompt (built by `buildPickupPrompt` from `lib/v5/build-pickup-prompt.mjs`) is
the canonical resume mechanism — no separate handoff file is written.

## When to invoke

"session handoff", "wrap up session", "hand off", "handoff summary", or user about to `/clear`.

## Pull state from (in order)

1. `control/v5/features/{slug}/status.json` — current `stage`, `currentPhase`, `featureType`
2. `control/v5/features/{slug}/decisions.json` — locked decisions, pending items, deferred questions
3. `control/v5/features/{slug}/journal/` — most recent journal entry for what shipped this session
4. Files created or modified this session
5. Unresolved questions from this session

Do NOT audit the filesystem. No broad sweeps beyond the active feature's directory.

## Output — chat only

Use this structure every time:

```
# Session Handoff — <title>

## Where it started
...

## Decisions locked + what shipped
- ...

## Key files for next session
- `<absolute path>` — why

## Running state
- Background processes: ... or none
- Dev servers: ... or none
- Branch: ... or none

## Verification
- `<command>` — expected outcome

## Deferred + open questions
- ...

## Pick up here
<pickup prompt from buildPickupPrompt({ slug, stage })>
```

## Hard rules

1. Chat output only — never write to file
2. Never invent state — write "none" for empty sections
3. Absolute paths always
4. Include background shell IDs + kill commands if any
5. The "Pick up here" section must contain the `buildPickupPrompt` output, not free-form instructions
