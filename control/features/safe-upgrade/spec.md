# Safe upgrade — Mission Control Kit

**Slug:** `safe-upgrade`
**Status:** approved
**Created:** 2026-05-24
**Last updated:** 2026-05-24

## Problem

Publishing MC v4 requires users to upgrade the kit without losing work. Today `install.sh` overwrites the entire control plane; only three files are restored. Re-running install is unsafe for teams with specs, journals, and custom control edits.

## Desired outcome

A user (developer or PM) can run **`/mc-upgrade`** or click **Update** in the dashboard and get:

- New orchestrator docs, skills, scripts, and dashboard template
- Refreshed vendor skill bundles (pinned refs)
- **Unchanged** feature specs, braindumps, explore findings, journals, phase plans, project artifacts, `state.json`, `HANDOFF.md`, and user `tech-stack/stack.json`
- A backup before apply and a readable upgrade report
- `npm test` proof the upgrader preserves user data

## User stories

### As a kit user, I want to upgrade safely

```
As a kit user,
I want to upgrade Mission Control without losing my feature specs,
So that I can adopt kit improvements while keeping my product work intact.

Acceptance criteria:
- Running upgrade on a project with features/*/spec.md leaves spec content byte-identical
- state.json, HANDOFF.md, tech-stack/stack.json preserved
- Kit docs (ROUTER.md, scripts/) updated to latest kit version
- .mc/install.json records new kitVersion and migrationsApplied
- Upgrade creates .mc/backups/{timestamp}/ before apply
```

### As a PM, I want a simple upgrade path

```
As a PM using Mission Control,
I want to see if an update is available in the dashboard,
So that I don't need terminal commands.

Acceptance criteria:
- Dashboard shows installed kit version
- When kit version > installed version, show "Update available" with instructions
- Guide disclosure mentions /mc-upgrade
```

### As a maintainer, I want programmatic migrations

```
As a kit maintainer,
I want schema migrations to run on upgrade,
So that status.json format changes don't break old projects.

Acceptance criteria:
- migrations/*.mjs run in order when kit version increases
- Migrations only touch metadata (status.json, state.json keys) — never spec.md body
- Dry-run lists migrations that would run
```

## Scope

### In scope (v1)

- `kit-manifest.json` at kit root (version, migrations list)
- `lib/mc-upgrade.mjs` — preserve rules, sync, backup, migrate, report
- `scripts/mc-upgrade.mjs` CLI (`--check`, `--dry-run`, `--install`)
- `control/.mc/install.json` stamp written on install/upgrade
- Refactor `install.sh` to delegate control sync to `mc-upgrade --install`
- `/mc-upgrade` command + `mc-upgrade` skill
- Dashboard version strip + update hint
- TDD: unit + integration tests (user spec survives upgrade)

### Out of scope

- Remote download from GitHub releases
- `_kit/` / `custom/` overlay filesystem
- Auto-update without user action
- Windows `.hta` Update button (document only in v1)

## Technical considerations

- **Preserve globs:** `features/*/` (except `_template`), `project/`, user tech-stack slugs, `.mc/backups/`
- **Always sync:** control root docs, `control/scripts/`, templates, skills, commands
- **Regenerate:** `dashboard.html` (never merge)
- **Vendor:** re-run bundle script after kit sync

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-24 | Preserve globs over `_kit/` split | Smaller v1 diff; matches current install layout |
| 2026-05-24 | install.sh calls mc-upgrade | Single code path for install and upgrade |
| 2026-05-24 | Bump kit to 4.1.0 | First version with upgrade manifest |

## Open questions

- [x] Remote fetch — deferred; local kit folder only in v1
