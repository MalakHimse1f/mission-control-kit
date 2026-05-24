# /mc-upgrade

Mission Control v4 — **safe upgrade** (refresh kit without overwriting your specs).

Invoke skill: `mc-upgrade`

Runs `node mission-control-kit/scripts/mc-upgrade.mjs` with user-data preserve rules.

Options: `--check` (update available?), `--dry-run` (preview changes).

Your `features/`, journals, specs, `state.json`, and `HANDOFF.md` are never overwritten.
