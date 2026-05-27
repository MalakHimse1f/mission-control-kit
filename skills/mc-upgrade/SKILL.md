---
name: mc-upgrade
description: "Mission Control — safe kit upgrade. Refreshes orchestrator docs and skills without overwriting user specs. Usage: /mc-upgrade"
---

# Mission Control — Safe upgrade (v5)

**You are the Orchestrator** (or user invoked directly).

## Goal

Upgrade the Mission Control kit runtime while **preserving** user workspace data:

- `control/v5/**` (features, decisions, journals, state, routing docs)
- `control/v5/state.json` install stamp and feature registry
- User `tech-stack/stack.json`

## Steps

1. Resolve project root and kit path (`mission-control-kit/` or `install.json` → `kitPath`).
2. Run:
   ```bash
   node "{kit}/scripts/mc-upgrade.mjs" "{projectRoot}"
   ```
3. Optional preflight (dry-run — no writes):
   ```bash
   node "{kit}/scripts/mc-upgrade.mjs" "{projectRoot}" --dry-run
   ```
4. Optional check (version diff only, no writes):
   ```bash
   node "{kit}/scripts/mc-upgrade.mjs" "{projectRoot}" --check
   ```
5. Fetch from GitHub release (when `release.github` configured in manifest):
   ```bash
   node "{kit}/scripts/mc-upgrade.mjs" "{projectRoot}" --fetch
   ```
6. Report: versions before/after, files synced, preserved count, backup path
   (`.mc/backups/`), and the `UPGRADE-REPORT.md` location.
7. Call `openDashboard({ controlRoot })` from `lib/v5/auto-launch.mjs` and tell
   the user the URL — the version strip on the dashboard shows the installed kit
   version.

## Do NOT

- Overwrite `control/v5/features/*/status.json` or `decisions.json`
- Delete user feature folders
- Skip backup when upgrading from an existing install
- Remove or overwrite `control/v5/state.json`
