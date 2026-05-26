# Team Collaboration — Braindump

Original notes from the kickoff conversation, lightly tidied.

- We need multiple people editing the same doc. Google Docs energy but scoped to our workspace.
- Latency matters more than absolute correctness for cursor movement — feel snappy.
- For text edits, correctness matters more than speed — no silent merges that lose work.
- Presence first. If I open a doc and a teammate is in it, I should see that within a second.
- Cursors should have name tags. Color-coded per user.
- Conflict UX is the scary part. We do NOT want "your changes were not saved" dialogs.
- Show both versions inline when they conflict. Make resolution a deliberate action.
- Up to ~20 simultaneous editors per doc. Probably 90% of sessions are 2-3 people.
- Auto-save is non-negotiable. Every keystroke.
- Offline editing is interesting but not for v1.
- Sync algorithm is the big tech question. OT vs CRDT vs LWW. Each has tradeoffs.
- OT: battle-tested (Google Docs), but server-coordinated and complex.
- CRDT (Yjs): elegant, peer-friendly, but document size overhead can be real.
- LWW + vector clocks: simplest, but conflict handling is more punitive.
- Transport: WebSockets feel obvious. SSE doesn't do bidirectional well. WebRTC is overkill until peer-to-peer matters.
- Need to think about reconnection. Buffer locally, replay on reconnect.
- Don't want to ship until we've benchmarked sync algorithm against our actual document sizes.
- Beta cohort: 5 of our biggest teams. Two-week soak.
- Metrics: cursor latency p95, edit-loss reports, max concurrent editors.
- Future: comments, suggestions, voice. All separate features.
- Should we show "X is typing..." like chat? Maybe. Defer.
- One thing I want to avoid: the "ghost cursor that lingers after a user leaves" anti-pattern.
- Make sure the avatar bar doesn't push document content around when collaborators join/leave.
- Accessibility: screen readers should announce "Teammate joined" but not on every keystroke.
- Pricing tier impact: collaboration is a Team-plan feature. Free tier sees the avatar bar but cannot have >1 active editor.
