# Parallel execution — orchestrator rules

Referenced from `./SKILL.md`. Implements §11 of `docs/REFACTOR-REQUIREMENTS.md`.

## Core rule

**If work CAN be parallelized, it MUST be parallelized.** Sequential execution
is acceptable only when there is a true data dependency between tasks. The
orchestrator's default posture is "dispatch in parallel"; falling back to
sequential dispatch is a deliberate, justified choice — not a habit.

When you do dispatch in parallel, tell the user:

> Dispatching N tasks in parallel: [list of task ids/names].

## Parallelization points per phase

| Phase | Parallel opportunity |
|-------|----------------------|
| Research | Dispatch every research query at once. Each is read-only. |
| Explore | Multiple codebase explorations (different folders / concerns) run together. |
| Brainstorming | Research subagents and diagram-generation subagents overlap. The braindump narrative does NOT block diagram drafts. |
| Plan | Platform plans for independent platforms (web / mobile / backend) run as one batch. |
| Build | Independent tasks inside a phase (no shared files, no shared schema, no input/output chain) run together. |
| Review | Spec review for task A and quality review for task B overlap when they touch different surfaces. |

## Dependency detection rules

Before dispatching, evaluate every candidate pair against this checklist:

- **Same files?** Sequential. File-level collision is enough — do not try to
  reason about line-level merges.
- **Does B require A's output?** (artifact, decision, generated file, schema
  change.) Sequential. B goes in a later batch.
- **Different features or modules with no shared files?** Parallel.
- **All read-only (no `files`, no writes)?** Always parallel.
- **Shared database migration or schema change?** Sequential. Schema changes
  are treated like shared files even if their on-disk path differs.

Phase plans MUST mark task dependencies explicitly. An unmarked task is
assumed independent and will be dispatched in parallel — so missing a
dependency annotation is a correctness bug in the plan, not a feature.

## How to use the dependency-graph helper

The orchestrator uses `lib/v5/dependency-graph.mjs` to turn a flat task list
into parallel batches.

```js
import { analyzeTasks } from '../../lib/v5/dependency-graph.mjs';

const tasks = [
  { id: 'A', name: 'add login form',  files: ['src/login.tsx'] },
  { id: 'B', name: 'add signup form', files: ['src/signup.tsx'] },
  { id: 'C', name: 'wire auth API',   files: ['src/api.ts'], dependsOn: ['A', 'B'] },
];

const { parallel, sequential } = analyzeTasks(tasks);
// parallel:  [ ['A', 'B'], ['C'] ]
// sequential: ['A', 'B', 'C']   (used only when forcing serial execution)

for (const batch of parallel) {
  // Dispatch every id in `batch` simultaneously, then await all before
  // moving to the next batch.
}
```

Task shape:

- `id` — unique string.
- `name` — human-readable label (optional, for logs).
- `files` — exact paths the task writes. Read-only tasks pass `[]` or omit.
- `dependsOn` — ids of tasks that must finish first.

`analyzeTasks` packs tasks so that any pair with a shared file or an explicit
`dependsOn` lands in different batches. Use `sequential` only when an
operator forces single-stream execution (debugging, hostile environment).

To pre-flight a plan for collisions, call `detectFileConflicts(tasks)` and
surface the result to the user before dispatching:

```js
import { detectFileConflicts } from '../../lib/v5/dependency-graph.mjs';

const conflicts = detectFileConflicts(tasks);
// [{ taskA: 'A', taskB: 'B', files: ['src/api.ts'] }, ...]
```

Cyclic dependencies throw — fix the plan rather than catching.

## What this skill does NOT do

- It does not parse globs. Pass exact paths in `files`.
- It does not analyze line ranges. File-level conflict is the unit.
- It does not know about runtime cost. The orchestrator is responsible for
  capping concurrency (e.g., never more than ~5 subagents at once) — the
  helper only reports what is theoretically parallelizable.
