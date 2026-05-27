---
name: mc-validate
description: "Mission Control stage 5 — phase validation gate. Usage: /mc-validate <slug> <phase-N>"
disable-model-invocation: true
argument-hint: [feature-slug] [phase-N]
---

# Mission Control — Stage 5: Validate

**First:** Load the `mission-control` skill, then load the Superpowers `verification-before-completion` skill (Skill tool).

## Args

$ARGUMENTS

Parse as `{slug}` and `{phase-N}` (e.g. `billing-portal phase-1`).

## This session

Run the validation gate from `IMPLEMENTATION_RULES.md` for the affected workspace(s):

- unit tests — exit 0
- build — exit 0
- lint — exit 0
- e2e — exit 0 (real UI per rules)

Show command output as evidence. Do not claim pass without running commands.

## On failure

When **any** check fails (unit, build, lint, or e2e):

1. **Short failure report** in chat — which check failed, command run, key error lines. Do **not** update phase as validated.
2. **Fix loop** — repeat until **all** checks exit 0:
   1. **Dispatch code quality reviewer** subagent (Task tool) — failure output + relevant changed files; concrete fix guidance required.
   2. **Dispatch implementer/patcher** subagent (Task tool) — apply fix only; no new scope.
   3. Re-run the full validation gate (or at minimum the failed check(s) plus e2e if UI-related).
3. After each failed attempt, report pass/fail briefly before the next loop iteration.

If fix loop is **BLOCKED** after reasonable attempts, use session boundary below — do not claim validation passed.

## On success

Update `status.json`, `HANDOFF.md`, regenerate dashboard.

## Session boundary — MUST tell the user

If more phases remain:

```
Phase {N} validation passed for `{slug}`.

Start a NEW session:
  /mc-plan {slug}     (if next phase not yet planned)
  /mc-build           (if next phase plan already exists)
```

If feature complete:

```
Feature `{slug}` complete.

Start a NEW session for the next feature:
  /mc-plan <next-slug>  or  /mc-build
```

Optional: /mc-handoff

## Session boundary — validation still failing

```
Validation failed for `{slug}` phase {N}.

Failed check(s): [list]
Fix loop: [in progress | blocked]

Start a NEW session and run:
  /mc-validate {slug} phase-{N}

Or continue fixes in this chat if the agent is still active.
```

Optional: /mc-handoff
