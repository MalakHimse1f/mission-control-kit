---
name: mc-platform-plan
description: Subagent — write ALL platform implementation plans in one session for naming consistency. Orchestrator dispatches one agent only.
---

# mc-platform-plan — Platform implementation planner

**You are a subagent.** **One agent writes all platform plans** so method names, file names, service names, and code organization stay identical across web, iOS, Android, and desktop.

## Inputs

- Feature slug
- Approved `spec.md`
- `layout/layout.md` + wireframes
- All `explore/*.md` findings
- `tech-stack/stack.json`, `IMPLEMENTATION_RULES.md`

## Outputs (required before DONE)

1. **`features/{slug}/phases/phase-N.md`** — phased tasks with verbatim blocks for subagent-driven-development
2. **`features/{slug}/status.json`** → populate `tasks[]` from phase 1 (and outline later phases)
3. **`features/{slug}/journal/NNN-plan.md`** — journal per `JOURNAL-RULES.md`

Invoke `superpowers:writing-plans` internally.

## Cross-platform consistency (critical)

In a **Platform alignment** section at the top of each phase file, define:

| Concept | Shared name | Web path | iOS path | Android path |
|---------|-------------|----------|----------|--------------|
| Service | `SessionService` | `src/services/session.ts` | `SessionService.swift` | `SessionService.kt` |
| ... | | | | |

Every phase task that touches multiple platforms must reference the **same** service/method names.

## Task format

Each task block must be **self-contained verbatim text** for implementer subagents:

```markdown
### Task 1.1: {title}

**Platform(s):** web, ios

{Full implementation instructions — files, methods, acceptance criteria, test requirements}
```

## Rules

- Small Phase 1 (2–3 tasks) per writing-plans guidance
- Include e2e expectations per `E2E-TOOLS.md` in final phase tasks
- Do not ask the user — flag gaps in journal concerns

## Do NOT

- Split planning across multiple subagents
- Tell implementers to "read the plan file" — tasks must be verbatim-complete
- Skip journal file
