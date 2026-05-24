# Mission Control Kit

**Structured agent workflows for Cursor and Claude Code — with a live dashboard so you always know where you left off.**

Mission Control Kit turns open-ended AI chat into a **repeatable pipeline**: braindump → research → spec → mock → plan → build → validate. One orchestrator coordinates specialized subagents. Every step writes to disk. You get high-quality artifacts *and* a clear picture of progress — whether you're a PM shaping the product or a senior engineer shipping it.

[Releases](https://github.com/MalakHimse1f/mission-control-kit/releases) · [User Guide](User-Guide.html) · MIT License

---

## The problem

Most agent sessions start from zero. Context drifts. PRDs live in chat history. Engineers re-explain the codebase every time. PMs can't see what's spec'd vs. built. When you switch agents or come back tomorrow, nobody knows the current stage.

Mission Control Kit fixes that by making **your repo the source of truth** — not the conversation.

---

## What you get

### Structured prompting that produces real artifacts

Two workflows cover the full product lifecycle:

| Workflow | Command | Output |
|----------|---------|--------|
| **Project START** | `/mc-start` | Market positioning, platform choices, stack, portfolio plan |
| **Add Feature** | `/mc-feature` | Research, PRD, UX spec, wireframe mock, implementation plan, built code, validation |

Each stage has a **defined prompt, scope, and deliverable**. Subagents receive tight context packets — not the whole repo — so output stays focused and reviewable. Vendor skills (startup research, design research, PRD generation) plug in at the right step automatically.

### A visual dashboard

Open `docs/superpowers/control/dashboard.html` in any browser:

- **Every feature at a glance** — pipeline stage, spec status, build phase, open tasks
- **Portfolio view** — what to build next across multiple features
- **Tech stack & project docs** — linked from one place
- **Version & upgrade hints** — stay current without losing your specs

No login. No SaaS. It's static HTML generated from the same files your agents read.

### Pick up where you left off — with any agent

Disk state survives session clears, model switches, and handoffs between Cursor and Claude Code:

- `state.json` — active workflow and stage
- `HANDOFF.md` — what the orchestrator last knew
- `features/{slug}/` — braindump, spec, journals, phase plans
- `/mc` — resume from disk in one command

Start with Claude Code on Monday, continue in Cursor on Tuesday. Swap models mid-feature. The orchestrator reads the journal, checks status, and dispatches the next subagent — no re-briefing.

---

## Built for PMs and senior engineers

### For product managers & designers

You don't need to write code to get value. Mission Control guides you through:

- **Braindump → clarify** — capture intent before anyone builds the wrong thing
- **Research & PRD** — structured specs with user stories and acceptance criteria (via [prd-generator](https://github.com/jamesrochabrun/skills))
- **UX & wireframe mocks** — clickable HTML flows for review (via [designer-skills](https://github.com/Owl-Listener/designer-skills))
- **Dashboard review** — approve specs, see what's waiting on engineering, track portfolio order

Talk to the **orchestrator only**. It routes work to the right specialist agent and writes everything where your team can find it.

### For senior engineers

You get guardrails without bureaucracy:

- **Scoped context packets** — subagents read only what the stage requires
- **BUILD-GATES** — lint, compile, test, build before a task is "done"
- **Subagent-driven development** — orchestrator dispatches; implementers don't inherit chat noise
- **Safe upgrades** — refresh kit skills and control docs; your `features/` specs and journals are never overwritten
- **Portfolio planning** — `/mc-portfolio` for dependency-aware build order across features

The orchestrator never writes production code directly. It coordinates, verifies, and keeps the pipeline honest.

---

## How it works

```
You  →  Orchestrator (/mc, /mc-start, /mc-feature)
              ↓
         Route + context packet
              ↓
         Subagent (explore, PRD, mock, plan, build…)
              ↓
         Journal + status.json on disk
              ↓
         Dashboard updates  →  You review  →  Next stage
```

Works with **[Superpowers](https://github.com/obra/superpowers)** (brainstorming, writing-plans, subagent-driven-development, verification-before-completion) and ships ready for **Cursor** and **Claude Code**.

---

## Quick install

### Release tarball (recommended)

1. Download [`mission-control-kit-{version}.tar.gz`](https://github.com/MalakHimse1f/mission-control-kit/releases/latest)
2. Extract into your project root → creates `mission-control-kit/`
3. Run the installer:

```bash
chmod +x mission-control-kit/install.sh
./mission-control-kit/install.sh . both
```

**Windows:** double-click `Run-Installer.hta`, or:

```powershell
& ".\mission-control-kit\install.ps1" -ProjectRoot .
```

### Clone into your project

```bash
cd /path/to/your-project
git clone https://github.com/MalakHimse1f/mission-control-kit.git mission-control-kit
cd mission-control-kit && chmod +x install.sh && ./install.sh .. both
```

Install copies the control plane to `docs/superpowers/control/`, skills to `.cursor/` and `.claude/`, and bundles required vendor skills.

---

## Commands

| Command | When |
|---------|------|
| `/mc-start` | New product — market, stack, portfolio |
| `/mc-feature` | New capability in an existing product |
| `/mc-init` | Register tech stack (once) |
| `/mc` | Resume from disk |
| `/mc-portfolio` | Review build order across features |
| `/mc-handoff` | End-of-session summary for the next agent |
| `/mc-upgrade` | Safe kit update (specs preserved) |

---

## Upgrade

Your feature specs, journals, and `custom/` overrides are **never overwritten**.

```bash
node mission-control-kit/scripts/mc-upgrade.mjs .          # upgrade
node mission-control-kit/scripts/mc-upgrade.mjs . --fetch    # pull latest release
```

Or `/mc-upgrade` in chat · `Run-Updater.command` (Mac) · `Run-Updater.hta` (Windows)

---

## What's in the kit

```
mission-control-kit/
├── control/           → docs/superpowers/control/  (orchestrator rules, dashboard, features/)
├── commands/          → .cursor/commands/
├── skills/            → .cursor/skills/
├── claude-skills/     → .claude/skills/
├── lib/               → router + safe upgrade engine
└── install.sh
```

Key docs: `ROUTER.md`, `ORCHESTRATOR.md`, `CONTEXT-PACKETS.md`, `BUILD-GATES.md`

---

## Development

```bash
npm test
npm run build:release
```

See `PUBLISH.md` for release tagging.

---

## License

MIT — see [LICENSE](LICENSE).
