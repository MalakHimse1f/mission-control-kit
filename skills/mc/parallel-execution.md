# Parallel execution — orchestrator rules

Referenced from `./SKILL.md`. Cross-reference:
`control/v5/routing/ROUTING-MANIFEST.md` for the full dispatch context.

## Core rule

**If work CAN be parallelized, it MUST be parallelized.** Dispatch every
independent task in a single `tool_use` block so the subagents run
concurrently. Sequential execution is a deliberate exception (true data
dependency, shared file, schema change), not the default.

## Programmatic check

Use `lib/v5/dependency-graph.mjs` to turn a flat task list into parallel
batches before dispatching:

```js
import { analyzeTasks } from '../../lib/v5/dependency-graph.mjs';
const { parallel } = analyzeTasks(tasks);     // [[A, B], [C]]
for (const batch of parallel) await Promise.all(batch.map(dispatch));
```

Task shape: `{ id, name?, files: [...exactPaths], dependsOn?: [ids] }`. Tasks
that share a `files[]` entry or have an explicit `dependsOn` land in different
batches.

## Concurrency cap

At most **5 parallel subagents** in any single `tool_use` block (Claude Code
constraint). If a batch is larger, chunk it into groups of 5 and await each
chunk before dispatching the next.
