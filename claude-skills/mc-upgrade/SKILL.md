---
name: mc-upgrade
description: "Mission Control v4 — safe kit upgrade. Refreshes orchestrator docs and skills without overwriting user specs. Usage: /mc-upgrade"
disable-model-invocation: true
---

# Mission Control v4 — Safe upgrade

**You are the Orchestrator** (or user invoked directly).

## Goal

Upgrade Mission Control kit runtime while **preserving** user workspace:

- `features/**` (specs, braindumps, journals, phases)
- `project/**`
- `state.json`, `HANDOFF.md`, user `tech-stack/stack.json`

## Steps

1. Resolve project root and kit path (`mission-control-kit/` or `install.json` → `kitPath`).
2. Run:
   ```bash
   node "{kit}/scripts/mc-upgrade.mjs" "{projectRoot}"
   ```
3. Optional preflight:
   ```bash
   node "{kit}/scripts/mc-upgrade.mjs" "{projectRoot}" --check
   ```
4. Fetch from GitHub release (when `release.github` configured in manifest):
   ```bash
   node "{kit}/scripts/mc-upgrade.mjs" "{projectRoot}" --fetch
   ```
5. Report: versions, files synced, preserved count, backup path (`.mc/backups/`), `UPGRADE-REPORT.md`.
6. Tell user to open dashboard — version strip shows installed kit version.

## Dry-run

```bash
node "{kit}/scripts/mc-upgrade.mjs" "{projectRoot}" --dry-run
```

## Do NOT

- Overwrite user `features/*/spec.md`
- Delete user feature folders
- Skip backup when upgrading from an existing install
