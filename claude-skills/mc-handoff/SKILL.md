---
name: mc-handoff
description: "Mission Control — chat session summary before /clear. Usage: /mc-handoff"
disable-model-invocation: true
---

# Mission Control — Session Handoff

**MUST invoke:** `session-handoff` skill.

Also read `docs/superpowers/control/HANDOFF.md` (disk handoff is always authoritative).

## Output

Chat-only summary using the session-handoff template. Synthesize from this session + control plane files.

## After handoff — tell the user

```
Disk handoff (always current): docs/superpowers/control/HANDOFF.md
Dashboard: docs/superpowers/control/dashboard.html

Safe to /clear. Next chat, run the command from the "Pick up here" section above, usually:
  /mc-build   (if building)
  /mc-plan <slug>   (if planning)
  /mc-refine <slug>   (if refining)
```
