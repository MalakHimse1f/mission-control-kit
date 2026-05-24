# Implementation Rules (example)

Copy to `docs/superpowers/IMPLEMENTATION_RULES.md` and customize for your project.

## Build discipline

- Subagent per task — orchestrator dispatches, never implements directly
- TDD: failing test → pass → commit
- One commit per task
- E2e tests use real UI where applicable

## Validation gate (per phase)

- Unit tests pass
- Build passes
- Lint passes
- E2e tests pass

## UI / product (customize)

- Describe your project's UX constraints here
- What "done" means for a feature

## Amendments

Changes require explicit product owner approval.
