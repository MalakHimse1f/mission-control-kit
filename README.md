# Mission Control Kit v4

Portable agent orchestration for **Cursor** and **Claude Code** with **Superpowers** — disk is the source of truth.

**Install · Upgrade · Releases:** [github.com/MalakHimse1f/mission-control-kit](https://github.com/MalakHimse1f/mission-control-kit)

---

## Two workflows

| Command | When | Requires |
|---------|------|----------|
| `/mc-start` | New product (market, stack, portfolio) | [startup-skill](https://github.com/ferdinandobons/startup-skill) |
| `/mc-feature` | New capability (research → build → validate) | [designer-skills](https://github.com/Owl-Listener/designer-skills) + [prd-generator](https://github.com/jamesrochabrun/skills/tree/main/skills/prd-generator) |

Also: `/mc-init`, `/mc`, `/mc-portfolio`, `/mc-handoff`, `/mc-upgrade`

---

## Quick install

### Option A — Release tarball (recommended)

1. Download `mission-control-kit-{version}.tar.gz` from [Releases](https://github.com/MalakHimse1f/mission-control-kit/releases)
2. Extract into your project root (creates `mission-control-kit/`)
3. Install:

```bash
chmod +x mission-control-kit/install.sh
./mission-control-kit/install.sh . both
```

Windows: double-click `Run-Installer.hta` or:

```powershell
& ".\mission-control-kit\install.ps1" -ProjectRoot .
```

### Option B — Clone this repo into your project

```bash
cd /path/to/your-project
git clone https://github.com/MalakHimse1f/mission-control-kit.git mission-control-kit
cd mission-control-kit
chmod +x install.sh
./install.sh .. both
```

Install copies the control plane to `docs/superpowers/control/`, skills/commands to `.cursor/` and `.claude/`, and bundles vendor skills.

---

## Upgrade (specs preserved)

User `features/`, specs, journals, and `state.json` are **never overwritten**.

```bash
node mission-control-kit/scripts/mc-upgrade.mjs .           # upgrade
node mission-control-kit/scripts/mc-upgrade.mjs . --check   # update available?
node mission-control-kit/scripts/mc-upgrade.mjs . --fetch     # download latest release
```

Or in chat: **`/mc-upgrade`**

Non-developer: `Run-Updater.command` (Mac), `Run-Updater.hta` (Windows), or **User-Guide.html**.

> **Legacy folder:** Upgrades still find `mission-control-kit-v4/` if present. Rename to `mission-control-kit/` when convenient.

---

## What's in the kit

```
mission-control-kit/     ← folder name in your project (no version in path)
├── control/           → docs/superpowers/control/
├── commands/          → .cursor/commands/
├── skills/            → .cursor/skills/
├── claude-skills/     → .claude/skills/
├── lib/               → upgrade + router engine
├── vendor/manifest.json
└── install.sh
```

Key control docs: `ROUTER.md`, `SKILL-DEPENDENCIES.md`, `CONTEXT-PACKETS.md`, `BUILD-GATES.md`.

---

## Development

Clone this repo to `~/Documents/mission-control-kit` (or anywhere outside your app repo):

```bash
npm test
npm run build:release
```

See `PUBLISH.md` for release tagging.

---

## License

MIT — see [LICENSE](LICENSE).
