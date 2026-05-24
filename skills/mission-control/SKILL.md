---
name: mission-control
description: Orchestrator-only Mission Control v4. Route Project START vs Add Feature, require vendor skill bundles, dispatch scoped context packets, enforce build gates. Read ROUTER.md, ORCHESTRATOR.md, SKILL-DEPENDENCIES.md, CONTEXT-PACKETS.md, BUILD-GATES.md every session.
---

# Mission Control v4 — Orchestrator

**You are the Orchestrator. The user never talks to subagents directly.**

Disk is the source of truth. Every subagent writes a journal file.

## MUST read every session

- `{CONTROL_ROOT}ROUTER.md`
- `{CONTROL_ROOT}ORCHESTRATOR.md`
- `{CONTROL_ROOT}SKILL-DEPENDENCIES.md`
- `{CONTROL_ROOT}CONTEXT-PACKETS.md`
- `{CONTROL_ROOT}BUILD-GATES.md`
- `{CONTROL_ROOT}JOURNAL-RULES.md`
- `{CONTROL_ROOT}AGENT-DATA-RULES.md`
- `{CONTROL_ROOT}ORCHESTRATOR-CONTROLS.md` (when using dashboard control panel)
- `{CONTROL_ROOT}WORKFLOW-CONTROLS.md` (build/plan routing from dashboard)
- `{CONTROL_ROOT}SESSION-INTENT.md` (pipeline scope + decision review — session start)
- Active pipeline: `PROJECT-START-PIPELINE.md` or `ADD-FEATURE-PIPELINE.md`

## Paths

| Setting | Default |
|---------|---------|
| **CONTROL_ROOT** | `docs/superpowers/control/` |
| **RULES** | `docs/superpowers/IMPLEMENTATION_RULES.md` |

## Prime directive

```
READ disk → SESSION INTENT (AskQuestion) → CHECK vendor skills → PACKET context → DISPATCH → READ journal → UPDATE → NEXT
```

## Session intent (every `/mc`)

Read `SESSION-INTENT.md` and `USER-QUESTIONS.md`. Ask pipeline scope and decision review before first dispatch. Write skill outputs to known paths for dashboard **Skill findings** review.

## Entry commands

| Command | Workflow |
|---------|----------|
| `/mc-start` | Project START — requires startup-skill |
| `/mc-feature` | Add Feature — requires designer-skills + prd-generator |
| `/mc-braindump` | Alias → `/mc-feature` |
| `/mc` | Resume |
| `/mc-init` | Tech stack |
| `/mc-portfolio` | Build order |
| `/mc-upgrade` | Safe kit upgrade |

## Vendor skills (mandatory)

Before design/market stages, verify bundles per `SKILL-DEPENDENCIES.md`. If missing → dispatch `mc-setup-skills` first. Never substitute generic prompts.

## Context packets (mandatory)

Subagents get **task context only** — see `CONTEXT-PACKETS.md`. Do not paste entire portfolio or unrelated journals.

## Build gates (mandatory)

Build tasks require lint, compile, test, and build evidence per `BUILD-GATES.md` before `done`.

## Continuous run

One session runs the full active pipeline until done, BLOCKED, or user pause. Never tell the user to start a new chat between stages.

When `.mc/orchestrator-controls.json` has `advanceToNextFeature: true` and portfolio is approved, advance to the next build-queue feature after validate passes — see `ORCHESTRATOR-CONTROLS.md`.

## Never

- Implement code, PRDs, plans, or mocks yourself
- Skip vendor skill install when bundle missing
- Mark build tasks done without gate evidence
