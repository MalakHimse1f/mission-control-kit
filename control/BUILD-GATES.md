# Build gates — Mission Control v4

Build work is not **done** until production-readiness checks pass. "Looks good" is not a gate.

---

## Per-task gates (implementer)

Before marking a build task `done` in `status.json`:

| Gate | Pass condition |
|------|----------------|
| **Lint** | Linter for touched platform exits 0; no new warnings |
| **Typecheck / compile** | Project compiles (tsc, xcodebuild compile, gradle compile) |
| **Unit / integration tests** | Relevant tests pass; new behavior covered when applicable |
| **Production build** | Release/bundle build succeeds when task touches shipping surface |
| **Commit** | Task committed with message referencing task id |
| **Journal** | `journal/NNN-build-{task-id}.md` with command output summaries |

Record in journal:

```markdown
## Verification
- lint: `{command}` → exit 0
- compile: `{command}` → exit 0
- test: `{command}` → exit 0, N passed
- build: `{command}` → exit 0, no warnings
```

If a gate cannot run (scaffold-only task), journal **why** and mark `DONE_WITH_CONCERNS` if appropriate.

---

## Phase-end gates (validator)

| Gate | When |
|------|------|
| **Phase task audit** | All phase tasks `done` or explicitly deferred |
| **E2E / smoke** | Per `E2E-TOOLS.md` when UI surface introduced |
| **Cross-platform parity** | When phase spans web/ios/android |
| **Screenshot evidence** | When `captureE2eScreenshots: true` in state.json |

Validator subagent is **read-only + test execution** unless fixing test harness itself.

---

## Review chain (unchanged from v3, enforced)

```
implementer → spec-reviewer → quality-reviewer → gates → commit → journal
```

Quality reviewer must confirm BUILD-GATES evidence exists before orchestrator marks task done.

---

## Platform command discovery

Commands live in:

- `tech-stack/stack.json` → scripts section
- Project `CLAUDE.md` / `IMPLEMENTATION_RULES.md`
- Phase plan task text

Orchestrator includes exact commands in the implementer's context packet — implementer does not guess.
