# Journal rules — subagent documentation

**Every subagent that completes work MUST write a journal file before reporting DONE.**

Disk is the audit trail. Chat is disposable. A new Orchestrator must reconstruct full context from journal files alone.

---

## Location

```
features/{slug}/journal/NNN-{step}-{optional-suffix}.md
tech-stack/{slug}/journal/NNN-{step}-{optional-suffix}.md
```

- `NNN` = zero-padded sequence (`001`, `002`, …) — next number = count existing journal files + 1
- One journal file per subagent completion (explore per codebase, one per build task, one per review cycle if substantial)

---

## Required frontmatter

```markdown
---
step: vendor-setup | explore | clarify | research | strategy | interaction | prd | mock | plan | build | validate
subagent: mc-setup-skills | mc-explore | mc-prd | mc-mock | mc-platform-plan | implementer | spec-reviewer | quality-reviewer | e2e-runner
status: DONE | DONE_WITH_CONCERNS | BLOCKED
feature: {slug}
completedAt: {ISO-8601}
taskId: {optional — build tasks only}
---

# {Title}

## Summary
2–5 sentences: what was done and outcome.

## Inputs received
What the orchestrator provided (paths, constraints, verbatim task text summary).

## Findings / changes
Bullet list of discoveries, files touched, decisions made.

## Artifacts written
| Path | Purpose |
|------|---------|
| explore/web-app.md | Web codebase map |
| spec.md | Approved PRD |

## Concerns / blockers
Empty if none. Otherwise explicit — orchestrator must resolve before next step.

## Next step hint
What the orchestrator should do next (one sentence).
```

---

## Orchestrator duties after subagent DONE

1. Read the journal file.
2. Update `status.json`:
   - Mark relevant `steps[]` entry `done` (or `in-progress` if step spans multiple subagents)
   - Set `pipelineStage` to next pending step
   - Append `journalFile` path to the step record
3. Update `HANDOFF.md`.
4. Regenerate dashboard:

```bash
node docs/superpowers/control/scripts/generate-dashboard.mjs
```

---

## Build tasks

Each committed build task gets `journal/NNN-build-{task-id}.md` covering:

- Implementer summary
- Spec review result (pass / issues fixed)
- Quality review result
- Test evidence (pass/fail output summary)
- Commit SHA + message
- E2e status if applicable

---

## Forbidden

- Subagent returns DONE without writing journal file
- Orchestrator skips journal read before dispatching next subagent
- Deleting journal files without explicit user request
- Journal content that only says "see chat" — must be self-contained
