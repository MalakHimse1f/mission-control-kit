# Phase 1 — Safe upgrade core

**Feature:** safe-upgrade
**Goal:** Programmatic upgrade with user-data preservation and TDD proof.

---

### Task 1.1: Upgrade manifest and preserve rules

Add `kit-manifest.json` and `lib/mc-upgrade.mjs` with:
- `shouldPreserve(relPath)` for control-plane paths
- `getKitVersion()`, `readInstallStamp()`, `writeInstallStamp()`
- Version compare helpers

**Verify:** `node --test tests/upgrade.test.mjs` (preserve rules)

---

### Task 1.2: Upgrade engine CLI

Add `scripts/mc-upgrade.mjs`:
- `--install` (first install stamp)
- `--check` (exit 1 if update available)
- `--dry-run` (print sync plan)
- Default: backup → sync control (preserve user) → sync skills/commands → bundle vendors → migrations → regenerate dashboard → write report

**Verify:** unit tests pass

---

### Task 1.3: Wire install.sh and mc-upgrade skill

- `install.sh` calls `node scripts/mc-upgrade.mjs "$PROJECT_ROOT" --install`
- Add `commands/mc-upgrade.md`, `claude-skills/mc-upgrade/SKILL.md`, `skills/mc-upgrade/SKILL.md`
- Register in ROUTER.md and dashboard guide

**Verify:** integration test

---

### Task 1.4: Dashboard version strip

Update `dashboard-template.mjs` + `dashboard-guide.mjs`:
- Show installed version from `.mc/install.json` when embedded at generate time
- "Update available" when kit manifest version > installed

**Verify:** dashboard-guide test updated

---

### Task 1.5: Integration test — spec survives upgrade

Test flow:
1. Install to temp project
2. Write custom `features/test-feat/spec.md`
3. Run upgrade
4. Assert spec unchanged; ROUTER.md updated; install.json version bumped

**Verify:** `npm test` all green

---

### Task 1.6: MC journals and status

Write journals for prd/plan/build/validate. Set `pipelineStage: done`, regenerate kit control dashboard if applicable.

**Verify:** feature status.json updated
