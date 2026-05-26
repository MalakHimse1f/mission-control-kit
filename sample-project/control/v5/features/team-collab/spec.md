# Team Collaboration — Spec

## Overview
Add real-time multi-user editing to the document workspace. Multiple users editing the same document should see each other's presence, cursors, and changes within ~150ms, with conflict resolution that never silently loses user input.

## Goals
- Allow up to 20 concurrent editors on a single document.
- Presence (avatars + cursors) updates within 200ms of remote activity.
- Concurrent edits to the same range produce visible, recoverable conflicts — never silent overwrites.
- No degradation to single-user editing latency.

## Non-goals
- Voice / video chat (handled by a separate calling product).
- Offline collaborative editing (covered in a future feature).
- Inline commenting / suggestions (separate spec: `inline-comments`).

## User stories
1. As an editor, I open a document and immediately see which teammates are also viewing or editing it.
2. As an editor, I see my teammates' cursors and selections move in real time.
3. As an editor, when my edit conflicts with a teammate's edit on the same passage, both versions remain visible until I resolve the conflict.
4. As an editor, my work is auto-saved on every keystroke so I never lose progress if my connection drops.

## UX decisions (locked)
- Collaborators surface as an **avatar bar at the top of the document**, with a hover state revealing names + activity.
- Conflicts surface as an **inline highlight** on the disputed passage with a small "Resolve" affordance.

## UI decisions (locked)
- Remote cursors: **colored caret with floating name tag** that fades to a thin line after 2s of inactivity.
- Collaborators panel: **top-of-document avatar bar** (no drawer).

## Architecture decisions
- **Transport (locked):** WebSocket with custom binary protocol over an authenticated session.
- **Sync algorithm (pending):** Choose between Operational Transform, CRDT (Yjs-style), or Last-Writer-Wins with vector clocks. Decision blocked on benchmarking against expected document sizes.

## Edge cases
- Connection drop during active typing → buffer changes locally; replay on reconnect.
- Remote user disconnect → fade their cursor after 5s, remove avatar after 30s.
- Document deletion mid-edit → all clients receive a tombstone and route to a recovery view.

## Open questions
- Should presence include a "currently typing" indicator? (Deferred from UX phase.)
- What's the upper bound on document size for the chosen sync algorithm?

## Success metrics
- p95 remote-cursor latency < 200ms.
- Zero reports of silent edit loss in the first 30 days of beta.
- Sustained 20-editor sessions with no perceptible client slowdown.
