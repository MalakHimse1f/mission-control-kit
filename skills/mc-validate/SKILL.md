---
name: mc-validate
description: "Mission Control — phase validation gate. Runs tests + e2e, advances pipeline. Usage: /mc-validate <slug> <phase-N>"
---

# Mission Control — Validate (phase gate)

**The orchestrator runs this inline** after phase-end e2e — not in a separate user session.

**MUST invoke:** `superpowers:verification-before-completion`

## Args

$ARGUMENTS — parse as `{slug}` and `{phase-N}` (e.g. `billing-portal phase-1`).

## Gate check before running

Before executing any tests, call `canAdvance` to confirm the gate is open:

```js
import { canAdvance, nextPhase } from '../../lib/v5/decision-gate.mjs';

const gate = await canAdvance({ slug, fromPhase: currentPhase, toPhase: targetPhase, controlRoot });
if (!gate.allowed) {
  // gate.reason explains why; gate.pending lists unresolved decisions.
  // STOP — surface reason to user. Do not run tests on a locked gate.
}
```

Use `nextPhase(currentPhase, isTechStack)` to compute `targetPhase`. Gate rules are defined in `control/v5/routing/BUILD-GATES.md`.

## Validation checks

Run all of the following. Show command output as evidence. Do not claim pass without running commands:

- unit tests — exit 0
- build — exit 0
- lint — exit 0
- **e2e — exit 0 for every layout target** (see E2e section below)

## E2e — platform-mandated, real UI, real DB

1. Read the project's layout configuration. If no UI surface — e2e N/A, skip to On success.
2. For each layout target, dispatch a fresh e2e runner subagent using the project's platform-appropriate MCP.
3. Real built app + real database + seeded test credentials. No mocks, no DB stubs, no auth bypasses.
4. If `captureE2eScreenshots: true` in `control/v5/features/{slug}/status.json`, save PNGs to `control/v5/features/{slug}/artifacts/phase-N/{platform}/` and call `openDashboard({ slug, controlRoot })` from `lib/v5/auto-launch.mjs`.
5. Any platform e2e non-zero = validation failed.

## On failure

1. Short failure report — which check failed, command, key errors.
2. Fix loop until all checks exit 0 (reviewer → patcher → re-run).
3. If **BLOCKED** after reasonable attempts → stop and report blocker. Do not claim validation passed.

## On success

1. Patch `control/v5/features/{slug}/status.json` — mark validate step done for phase N, set `validatedAt` to ISO timestamp, update `currentPhase` if advancing.
2. Call `openDashboard({ slug, controlRoot })` from `lib/v5/auto-launch.mjs` to surface the result.
3. **Continue in same session** — do not tell user to start new chat:

| Next | Orchestrator action |
|------|---------------------|
| More phases remain, next phase not planned | Dispatch `mc-platform-plan` for phase N+1 → build |
| More phases remain, plan exists | Advance `currentPhase` in `status.json` → dispatch build for phase N+1 |
| Feature complete | Set `stage: done` in `status.json` → report success |

Phase advancement uses `nextPhase` from `lib/v5/decision-gate.mjs` and is only executed after `canAdvance` returns `allowed: true`.

## Data rules

- Patch `control/v5/features/{slug}/status.json` in place.
- Keep `control/v5/state.json` in sync via `upsertFeature` from `lib/v5/state.mjs`.
- Never delete sibling features or decisions.
- `controlRoot` passed to any `lib/v5/*` API is the PROJECT ROOT (directory containing `control/v5/`).

See `control/v5/routing/DATA-RULES.md` for the full data contract.

## Do NOT

- Emit "Start a NEW chat" on success or between phases.
- Stop after validate when more work remains.
- Ask user to run `/mc-plan` or `/mc-build` in a separate session.
- Advance phase before `canAdvance` returns `allowed: true`.
- Claim validation passed without running and showing command output.
