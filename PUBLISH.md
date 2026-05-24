# Publishing Mission Control Kit

Canonical repo: **https://github.com/MalakHimse1f/mission-control-kit**

## Release tag format

Push a tag matching **`mc-kit-v{version}`** where `{version}` matches `kit-manifest.json` → `kitVersion`.

Example for kit version **4.3.0**:

```bash
git add -A
git commit -m "Release Mission Control Kit v4.3.0"
git tag mc-kit-v4.3.0
git push origin main
git push origin mc-kit-v4.3.0
```

GitHub Actions (`.github/workflows/mc-kit-release.yml`) will:

1. Run `npm test`
2. Build `dist/mission-control-kit-v4-{version}.tar.gz`
3. Attach the tarball to the GitHub Release

## Local dry run (before tagging)

```bash
npm test
node scripts/build-release-tarball.mjs
ls -lh dist/
```

## End-user install paths

| Method | Steps |
|--------|--------|
| **Release tarball** | Download asset → extract into project → `mission-control-kit-v4/install.sh .` |
| **Git clone** | `git clone … mission-control-kit-v4` → `./install.sh /path/to/project` |
| **Remote fetch** | `node mission-control-kit-v4/scripts/mc-upgrade.mjs . --fetch` |

## First release checklist

- [ ] `kitVersion` bumped in `kit-manifest.json` and `package.json`
- [ ] `npm test` passes
- [ ] `node scripts/build-release-tarball.mjs` produces tarball
- [ ] `release.github` is `MalakHimse1f/mission-control-kit`
- [ ] Tag pushed: `mc-kit-vX.Y.Z`
- [ ] GitHub Release shows asset `mission-control-kit-v4-X.Y.Z.tar.gz`

## Manual release (without Actions)

```bash
node scripts/build-release-tarball.mjs
gh release create mc-kit-v4.3.0 \
  --title "Mission Control Kit v4.3.0" \
  dist/mission-control-kit-v4-4.3.0.tar.gz
```

## Shape-Up / monorepo mirror

The kit may also exist as a subfolder copy inside private monorepos (e.g. `Shape-Up-Docs/mission-control-kit-v4/`). **Releases publish from this repo only.** Sync changes here first, then copy or submodule into monorepos.
