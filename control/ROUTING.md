# Routing manifest — Mission Control v4.8

One source of truth for *which documents each session loads*. The orchestrator
reads this, loads only the listed docs for the current stage, and dispatches.
No code resolver — this is the manifest.

## Universal (every session)
- `control/ORCHESTRATOR.md` — orchestrator rules
- `control/ROUTING.md` — this file
- On pickup also read on disk: `state.json`, `HANDOFF.md`, active `features/{slug}/status.json`

## Routes by stage / task type
| Stage / taskType | Load (only these) | Skip |
|------------------|-------------------|------|
| explore | braindump, `features/{slug}/explore/` template, target codebase tree | other features, plans, mock HTML |
| research | braindump, `explore/*` summaries | phase plans |
| clarify | braindump, `explore/*`, `USER-QUESTIONS.md` | unrelated features |
| prd | braindump, `explore/*`, research, clarify journal, `_template/spec.md` | phase plans, other features |
| mock | approved `spec.md`, layout targets, `layout/selection/SELECTION-UI.md` + `template.html` | build plans, other features |
| plan | approved `spec.md`, `tech-stack/stack.json`, explore maps | market/competitor docs |
| build | one task from `phases/phase-*.md`, touched files, `BUILD-GATES.md` | full PRD unless task cites a section |
| validate | spec acceptance, test inventory, `E2E-TOOLS.md` for the layoutTarget | implementation plans |
| ui / ux / architecture decisions | `layout/selection/SELECTION-UI.md` + the matching `example-*.html` | unrelated stages |

## Universal rules
- One purpose per document. If two docs overlap, route to one.
- Subagents get a **context packet** (see `CONTEXT-PACKETS.md`), not the whole repo.
- Decisions presented to the user use a selection deck (see `SELECTION-UI.md`); capture the chosen answer to disk.
- After explore/research/strategy/interaction stages, the orchestrator presents the HTML files to the user before advancing.
