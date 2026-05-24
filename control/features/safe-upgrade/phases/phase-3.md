# Phase 3 — Release automation & publish

**Feature:** safe-upgrade (continued)
**Kit version:** 4.3.0

---

### Task 3.1: Release tarball builder

`scripts/build-release-tarball.mjs` → `dist/mission-control-kit-{version}.tar.gz`

Excludes vendor clones, caches, sample-project skill copies.

### Task 3.2: GitHub Actions workflow

`.github/workflows/mc-kit-release.yml` on tag `mc-kit-v*`: test → build → gh release asset.

### Task 3.3: Windows Install vs Update

`Run-Installer.hta` — dialog with Install / Update buttons.
`Run-Updater.hta`, `upgrade.bat`.

### Task 3.4: PUBLISH.md + manifest repo

`release.github`: `MalakHimse1f/Shape-Up-Docs`

### Task 3.5: Tests

`tests/release-bundle.test.mjs` — excludes + tarball smoke extract.
