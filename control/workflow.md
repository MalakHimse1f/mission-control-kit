# Workflow — Mission Control v4

**Orchestrator-only.** User talks to `/mc`, `/mc-start`, or `/mc-feature`. Subagents do the work.

Open [dashboard.html](dashboard.html) for embedded artifacts.

---

## Commands (user-facing)

| Command | Workflow | Purpose |
|---------|----------|---------|
| `/mc-start <idea>` | Project START | New product — market, stack, portfolio |
| `/mc-feature <idea>` | Add Feature | New capability — design, spec, build |
| `/mc-braindump <idea>` | Add Feature | Legacy alias for `/mc-feature` |
| `/mc-init` | Setup | Tech stack (once) |
| `/mc` | Resume | Continue from disk |
| `/mc-upgrade` | Upgrade | Safe kit update (specs preserved) |
| `/mc-portfolio` | Portfolio | Multi-feature build order |

---

## Two pipelines

### Project START

Requires **startup-skill**. See `PROJECT-START-PIPELINE.md`.

### Add Feature

Requires **designer-skills**. See `ADD-FEATURE-PIPELINE.md`.

---

## v4 differences from v3

| v3 | v4 |
|----|-----|
| One feature pipeline | Project START + Add Feature |
| Full context in subagent prompt | Context packets (`CONTEXT-PACKETS.md`) |
| Optional external skills | Required vendor bundles (`SKILL-DEPENDENCIES.md`) |
| Tests sometimes | BUILD-GATES mandatory (`BUILD-GATES.md`) |
| `/mc-braindump` only | `/mc-start` for new products |

---

## Key docs

- `ROUTER.md` — classify intent
- `ORCHESTRATOR.md` — orchestrator rules
- `SKILL-DEPENDENCIES.md` — startup-skill + designer-skills
- `CONTEXT-PACKETS.md` — scoped subagent context
- `BUILD-GATES.md` — lint, compile, test, build
