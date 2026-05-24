# Journal — safe-upgrade phase 3

**Date:** 2026-05-24  
**Kit version:** 4.3.0

## Shipped

- `scripts/build-release-tarball.mjs` — produces `dist/mission-control-kit-v4-{version}.tar.gz` (273 files, ~0.23 MB)
- `.github/workflows/mc-kit-release.yml` — tag `mc-kit-v*` → test → build → GitHub Release asset
- `Run-Installer.hta` — Install / Update dialog; `Run-Updater.hta` + `upgrade.bat` for update-only
- `PUBLISH.md` — tag format, checklist, manual `gh release create`
- `kit-manifest.json` — `release.github`: `MalakHimse1f/Shape-Up-Docs`
- `tests/release-bundle.test.mjs` — exclude rules + tarball extract smoke

## Verification

```
npm test → 70/70 pass
node scripts/build-release-tarball.mjs → dist/mission-control-kit-v4-4.3.0.tar.gz
```

## Publish (when ready)

```bash
git add mission-control-kit-v4/ .github/workflows/mc-kit-release.yml
git commit -m "Release Mission Control Kit v4.3.0"
git tag mc-kit-v4.3.0
git push origin main
git push origin mc-kit-v4.3.0
```

Actions uploads the tarball; users can `--fetch` or download from Releases.
