# /mc-v5

Mission Control v5 — orchestrator hub. Resume or start v5 work from disk.

Invoke skill: `mc-v5`

Optional argument: a feature slug. If `$ARGUMENTS` is non-empty, treat the first token as the active feature `{slug}` and skip slug discovery. Otherwise, inspect `control/v5/features/` and brief the user.

Once invoked, follow the session-start steps in the `mc-v5` skill: read `control/v5/features/{slug}/status.json` and `decisions.json`, compute the current phase via `lib/v5/decision-gate.mjs`, and resolve routing via `lib/v5/mc-router.mjs` before dispatching any subagent.

v5 is a parallel pipeline to v4. Do not invoke the v4 `mc` skill here.
