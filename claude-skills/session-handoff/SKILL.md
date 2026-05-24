---
name: session-handoff
description: Use when the user says "session handoff", "wrap up session", "hand off", "handoff summary", or wants a structured end-of-session summary before clearing context. Produces a chat-only handoff covering decisions, shipped changes, key files, running state, verification steps, deferrals, and open questions so a fresh agent can continue seamlessly.
user-invocable: false
---

# Session Handoff

Chat-only summary before `/clear`. Persistent state lives in `{CONTROL_ROOT}/HANDOFF.md` (default: `docs/superpowers/control/HANDOFF.md`).

## When to invoke

"session handoff", "wrap up session", "hand off", "handoff summary", or user about to `/clear`.

## Pull state from (in order)

1. `{CONTROL_ROOT}/HANDOFF.md` and plan files under `{CONTROL_ROOT}/features/*/phases/`
2. TodoWrite state
3. Background shell IDs from this session
4. Files created or modified this session
5. Unresolved questions

Do NOT audit the filesystem. No `git log`, no broad sweeps.

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
<1-2 sentences>
```

## Hard rules

1. Chat output only — never write to file
2. Never invent state — write "none" for empty sections
3. Absolute paths always
4. Include background shell IDs + kill commands if any
