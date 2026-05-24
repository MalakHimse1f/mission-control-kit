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

Open `docs/superpowers/control/dashboard.html` in any browser (read-only), or run the **control panel server** to save orchestrator toggles:

```bash
node docs/superpowers/control/scripts/dashboard-server.mjs
# http://127.0.0.1:9470/
```

- **Every feature at a glance** — pipeline stage, spec status, build phase, open tasks
- **Orchestrator controls** — auto-advance build queue, ralph loop resume (saved to `.mc/orchestrator-controls.json` for agents)
- **Portfolio view** — what to build next across multiple features
- **Tech stack & project docs** — linked from one place
- **Version & upgrade hints** — compares install stamp to GitHub Releases (via dashboard server) and local kit folder

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

Works with **[Superpowers](https://github.com/obra/superpowers)** and **four bundled vendor repos** (below). Mission Control **does not substitute generic prompts** when a required skill is missing — it blocks and runs setup first.

---

## Open source skills (attribution & routing)

Mission Control is an **orchestrator**. It does not replace specialist skills — it **installs them, verifies them, and dispatches subagents at the right pipeline stage** with a scoped context packet and an explicit skill list on every route card.

```
Pipeline stage  →  check vendor skills  →  build route card  →  dispatch subagent
                         ↓                      ↓
                  mc-setup-skills          skills: [required invocations]
                  if missing               read: [exact paths only]
```

Install clones vendor repos into `.claude/skills/vendor/` (see `vendor/manifest.json`). The router engine (`lib/mc-router.mjs`) and `SKILL-DEPENDENCIES.md` define which skills are **required** at each stage. Subagent skills (e.g. `mc-prd`) embed mandatory invocations — generic “write a PRD” prompts are forbidden when `prd-generator` is available.

---

### Bundled — [Superpowers](https://github.com/obra/superpowers) by [Jesse Vincent (obra)](https://github.com/obra) (MIT)

**Workflows:** `/mc-start` and `/mc-feature` · **Install path:** `.claude/skills/vendor/superpowers/` (mirrored to `.cursor/skills/vendor/superpowers/`)

Cloned from [obra/superpowers](https://github.com/obra/superpowers) on install. Provides the core execution patterns Mission Control orchestrates — brainstorming before specs, phased plans, isolated implementers, and evidence-based validation. The full repo includes 14 skills; MC requires four at specific stages.

| Skill | What it does | Mission Control stage |
|-------|----------------|----------------------|
| **`brainstorming`** | Structured refinement — explores intent, alternatives, and constraints before committing to a spec | `braindump` / clarify — orchestrator invokes before locking scope |
| **`writing-plans`** | Phased implementation plans with checkpoints and task breakdown | `plan` — `mc-platform-plan` subagent; also `/mc-portfolio` |
| **`subagent-driven-development`** | Fresh implementer per task, status codes (`DONE`, `BLOCKED`, …), no context bleed | `build` — orchestrator dispatches implementers per phase task |
| **`verification-before-completion`** | Evidence before claims — run commands, confirm output before marking work complete | `validate` (Add Feature) — paired with BUILD-GATES |

**Also bundled (optional):** `systematic-debugging`, `test-driven-development`, `using-git-worktrees`, `executing-plans`, and others — available under the vendor folder for ad-hoc use.

Plugin install remains optional for marketplace updates. See `control/SUPERPOWERS-SETUP.md`. Preflight: `node docs/superpowers/control/scripts/check-setup.mjs`.

---

### Bundled — [startup-skill](https://github.com/ferdinandobons/startup-skill) by [ferdinandobons](https://github.com/ferdinandobons) (MIT)

**Workflow:** `/mc-start` (Project START) · **Install path:** `.claude/skills/vendor/startup-skill/`

Market validation, competitive intelligence, positioning, and pitch prep — the kind of deliverables a strategy consultant would produce, written to disk under `project/`.

| Skill | What it does | Mission Control stage |
|-------|----------------|----------------------|
| **`startup-design`** | 8-phase market validation: research, product definition, financial projections, go/no-go experiments | `validate` — orchestrator invokes; writes `project/market-brief.md` |
| **`startup-competitors`** | Competitor battle cards, pricing landscape, feature matrix from real web/review data | `compete` — when competitive landscape matters; writes `project/competitors.md` |
| **`startup-positioning`** | April Dunford positioning framework — category, alternatives, messaging implications | `position` — required before platform/stack lock; writes `project/positioning.md` |
| **`startup-pitch`** | Investor-ready pitches (10/5/2/1-min), scoring rubric, Q&A prep | `launch-prep` — optional when raising or presenting externally |

---

### Bundled — [designer-skills](https://github.com/Owl-Listener/designer-skills) by [Owl-Listener](https://github.com/Owl-Listener) (MIT)

**Workflow:** `/mc-feature` (Add Feature, UX path) · **Install path:** `.claude/skills/vendor/designer-skills/`

A collection of **91 skills across 9 plugins** (research → systems → UI → interaction → testing). Mission Control installs the full repo but **requires four plugins** at specific stages. The rest remain available for deeper work.

**Required by router (Add Feature UX pipeline):**

| Skill / plugin | What it does | Mission Control stage |
|----------------|----------------|----------------------|
| **`design-research`** | Personas, journey maps, interviews, usability synthesis — turns user evidence into design inputs | `research` — orchestrator invokes; writes `features/{slug}/research.html` |
| **`ux-strategy`** | Problem framing, IA, experience maps, competitive UX analysis, design principles | `strategy` — when scope is ambiguous; writes `features/{slug}/ux-strategy.html` |
| **`interaction-design`** | Flows, states, errors, navigation, forms, micro-interactions, cognitive laws (Fitts, Hick, …) | `interaction` — UI features; writes `features/{slug}/interaction.html` |
| **`visual-critique`** | Hierarchy, typography, composition, brand consistency audits | `mock` — before mock approval; `mc-mock` subagent runs wireframes, critique gates quality |

**Also in the bundle (optional — invoke when useful):** `ui-design`, `prototyping-testing`, `design-systems`, `design-ops`, `designer-toolkit` — layout systems, color/type scales, heuristic evaluation, handoff specs, etc.

---

### Bundled — [prd-generator](https://github.com/jamesrochabrun/skills/tree/main/skills/prd-generator) by [jamesrochabrun](https://github.com/jamesrochabrun) (from [skills](https://github.com/jamesrochabrun/skills) monorepo)

**Workflow:** `/mc-feature` · **Install path:** `.claude/skills/vendor/prd-generator/`

Structured PRD authoring for product managers: discovery questions, problem statements, user stories, success metrics, scope boundaries, and validation checklists — mapped into Mission Control's `features/{slug}/spec.md` template.

| Skill | What it does | Mission Control stage |
|-------|----------------|----------------------|
| **`prd-generator`** | Industry-standard PRD workflow — discovery → structure → stories → metrics → validation | `prd` — **`mc-prd` subagent MUST invoke** before writing `spec.md`; journal records which sections were applied |

---

### Shipped with Mission Control — orchestrator & subagent skills

These live in the kit (`skills/`, `claude-skills/`, `.cursor/commands/`) — not third-party repos, but they **enforce** vendor skill use:

| Subagent / skill | Role |
|------------------|------|
| **`mission-control`** / **`mc`** | Orchestrator hub — reads disk, routes pipeline, never writes code or PRDs directly |
| **`mc-setup-skills`** | Clones missing vendor bundles via `bundle-vendor-skills.sh`; journals setup |
| **`mc-explore`** | Codebase mapping per target repo — scoped to braindump paths only |
| **`mc-prd`** | Writes `spec.md` — **requires `prd-generator` invocation** |
| **`mc-mock`** | Wireframe HTML from layout library — pairs with `visual-critique` |
| **`mc-platform-plan`** | Cross-platform phase plans — uses **`writing-plans`** (Superpowers) |
| **`mc-start`** / **`mc-feature`** | Workflow entry points with vendor preflight |
| **`mc-upgrade`** | Safe kit updates — preserves all user specs |

---

### Stage → skill map (quick reference)

**Project START (`/mc-start`):**

| Stage | Who runs it | Required open-source skill |
|-------|-------------|---------------------------|
| vendor-setup | `mc-setup-skills` | superpowers + startup-skill bundles |
| validate | orchestrator | `startup-design` |
| compete | orchestrator | `startup-competitors` |
| position | orchestrator | `startup-positioning` |
| launch-prep | orchestrator | `startup-pitch` (optional) |

**Add Feature (`/mc-feature`):**

| Stage | Who runs it | Required open-source skill |
|-------|-------------|---------------------------|
| vendor-setup | `mc-setup-skills` | superpowers + designer-skills + prd-generator |
| braindump / clarify | orchestrator | `brainstorming` |
| research | orchestrator | `design-research` |
| strategy | orchestrator | `ux-strategy` |
| prd | `mc-prd` | **`prd-generator`** |
| interaction | orchestrator | `interaction-design` |
| mock | `mc-mock` | `visual-critique` |
| plan | `mc-platform-plan` | `writing-plans` |
| build | implementer | `subagent-driven-development` |
| validate | validator | `verification-before-completion` |

Tech-only features skip research, strategy, interaction, and mock stages — PRD and build skills still apply.

**Verify bundles:** `node mission-control-kit/scripts/check-vendor-skills.mjs . project-start` or `add-feature`

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

Install copies the control plane to `docs/superpowers/control/`, skills to `.cursor/` and `.claude/`, and bundles **Superpowers**, startup-skill, designer-skills, and prd-generator into `vendor/`.

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
