---
name: mc-validate
description: "Mission Control — orchestrator-internal validation gate. Usage: /mc-validate <slug> <phase-N>"
---

# Mission Control — Validate (orchestrator-internal)

**The orchestrator runs this inline** after phase-end e2e — not in a separate user session.

**MUST invoke:** `mission-control` skill + **`superpowers:verification-before-completion`**

**MUST read:** `tech-stack/E2E-TOOLS.md`

## Args

$ARGUMENTS — parse as `{slug}` and `{phase-N}` (e.g. `billing-portal phase-1`).

## Validation gate

Run from `IMPLEMENTATION_RULES.md` for affected workspace(s):

- unit tests — exit 0
- build — exit 0
- lint — exit 0
- **e2e — exit 0 for every `layoutTarget`** (see `E2E-TOOLS.md`)

Show command output as evidence. Do not claim pass without running commands.

### E2e — platform-mandated, real UI, real DB

1. Read `tech-stack/stack.json` → `layoutTargets[]`. Empty → e2e N/A.
2. For each `layoutTarget`, run e2e via MCP in `E2E-TOOLS.md`.
3. Real built app + real database + seeded test credentials. No mocks.
4. If `captureE2eScreenshots: true`, save PNGs to `features/{slug}/artifacts/phase-N/{platform}/` and regenerate dashboard.
5. Any platform e2e non-zero = validation failed.

## On failure

1. Short failure report — which check failed, command, key errors.
2. Fix loop until all checks exit 0 (reviewer → patcher → re-run).
3. If **BLOCKED** after reasonable attempts → stop and report blocker. Do not claim validation passed.

## On success

1. Update `status.json` — mark validate step done for phase N, set `ValidatedAt` if applicable.
2. Update `HANDOFF.md`, regenerate dashboard.
3. **Continue in same session** — do not tell user to start new chat:

| Next | Orchestrator action |
|------|---------------------|
| More phases remain, next phase not planned | Dispatch `mc-platform-plan` for phase N+1 → build |
| More phases remain, plan exists | Set `pipelineStage: build` → dispatch build for phase N+1 |
| Feature complete | Set `pipelineStage: done` → report success |

## Do NOT

- Emit "Start a NEW chat" on success or between phases
- Stop after validate when more work remains
- Ask user to run `/mc-plan` or `/mc-build` in a separate session
