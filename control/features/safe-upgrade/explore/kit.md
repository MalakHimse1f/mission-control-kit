# Explore — mission-control-kit-v4

## Current install (`install.sh`)

- `cp -R control/.` → project `docs/superpowers/control/` — **overwrites all control files**
- Only restores: `state.json`, `HANDOFF.md`, `tech-stack/stack.json`
- Skills/commands: full copy (overwrite)
- Vendor: `bundle-vendor-skills.sh`
- Dashboard: regenerated via `generate-dashboard.mjs`

**Risk:** User edits to control docs, any `features/*/`, `project/`, journals, specs — all clobbered on reinstall.

## Existing assets to reuse

| Asset | Role in upgrade |
|-------|-------------------|
| `vendor/manifest.json` | Pin vendor bundle refs |
| `scripts/check-vendor-skills.mjs` | Post-upgrade verify |
| `scripts/bundle-vendor-skills.sh` | Refresh vendor skills |
| `control/scripts/generate-dashboard.mjs` | Regenerate dashboard |
| `control/scripts/migrate-features-v3.mjs` | Pattern for migrations |
| `package.json` + `tests/*.test.mjs` | BUILD-GATES |
| `install.sh` backup/restore | Extend to preserve globs |

## Kit layout

```
mission-control-kit-v4/
  control/          → sync to project (with preserve rules)
  claude-skills/    → .claude/skills/
  skills/           → .cursor/skills/
  commands/         → .cursor/commands/
  scripts/          → stays in kit folder
  lib/              → mc-router.mjs today; add mc-upgrade.mjs
```

## Test harness

- `sample-project/` — integration install target
- `npm test` — 45+ tests; add upgrade tests

## Gaps

- No `kit-manifest.json` or install stamp
- No `mc-upgrade.mjs`
- No `/mc-upgrade` command or skill
- Dashboard has guide but no version/update strip
