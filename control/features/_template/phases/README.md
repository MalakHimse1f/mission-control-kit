# Phase plans

One markdown file per phase: `phase-1.md`, `phase-2.md`, etc.

Each plan follows the repo plan format:

- Link to [`IMPLEMENTATION_RULES.md`](../../../../IMPLEMENTATION_RULES.md) in Prerequisites
- Tasks use checkbox syntax with stable IDs: `### Task 1.1: Title`
- Task IDs in plans must match entries in `../status.json`

After writing a phase plan, initialize `status.json` tasks from the plan's task list (all `backlog` until build starts).
