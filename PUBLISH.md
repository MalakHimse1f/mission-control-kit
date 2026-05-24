# Publishing Mission Control Kit

Canonical repo: **https://github.com/MalakHimse1f/mission-control-kit**

Develop locally at `~/Documents/mission-control-kit` (outside app repos). The kit folder in user projects is always **`mission-control-kit/`** — no version in the path.

## Release tag format

Push a tag matching **`mc-kit-v{version}`** where `{version}` matches `kit-manifest.json` → `kitVersion`.

```bash
git add -A
git commit -m "Release Mission Control Kit v4.3.1"
git tag mc-kit-v4.3.1
git push origin main
git push origin mc-kit-v4.3.1
```

GitHub Actions will test, build `dist/mission-control-kit-{version}.tar.gz`, and attach it to the Release.

## Local dry run

```bash
npm test
node scripts/build-release-tarball.mjs
ls -lh dist/
```

## End-user install

| Method | Steps |
|--------|--------|
| **Release tarball** | Download → extract into project → `mission-control-kit/install.sh .` |
| **Git clone** | `git clone … mission-control-kit` inside project → `./install.sh ..` |
| **Remote fetch** | `node mission-control-kit/scripts/mc-upgrade.mjs . --fetch` |

## Manual release (without Actions)

```bash
node scripts/build-release-tarball.mjs
gh release create mc-kit-v4.3.1 \
  --title "Mission Control Kit v4.3.1" \
  dist/mission-control-kit-4.3.1.tar.gz
```
