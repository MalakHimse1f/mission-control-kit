# Phase 2 — Publish & fetch

**Feature:** safe-upgrade (continued)
**Goal:** Remote release fetch, PM-friendly updater, custom overlays, v4 command cleanup.

---

### Task 2.1: GitHub release fetch

`lib/fetch-kit-release.mjs` + `mc-upgrade --fetch --repo=owner/repo`

### Task 2.2: User-Guide + Run-Updater

`User-Guide.html` v4 with Install / Update sections. `Run-Updater.command`, `upgrade.sh`.

### Task 2.3: custom/ overlay

Preserve `control/custom/**` on upgrade; migration seeds README.

### Task 2.4: Command cleanup

Thin `mc-braindump` alias; deprecate v3 stage commands; `commands/legacy/README.md`.

### Task 2.5: Tests + bump 4.2.0

fetch-release unit tests; integration stamp 4.2.0; full npm test.
