# Add Feature pipeline — Mission Control v4

Use when adding a **capability to an existing product** with established stack and positioning.

**Command:** `/mc-feature <describe feature + target codebase paths>`

**Legacy alias:** `/mc-braindump` → same pipeline.

**Required bundles:** [designer-skills](https://github.com/Owl-Listener/designer-skills) + [prd-generator](https://github.com/jamesrochabrun/skills/tree/main/skills/prd-generator) — see `SKILL-DEPENDENCIES.md`.

**Prerequisite:** `techStackStatus: established` (run `/mc-init` or complete Project START stack stage first).

---

## Pipeline stages

| Step | ID | Orchestrator | Skills / agents | Disk output |
|------|-----|--------------|-----------------|-------------|
| 0 | `vendor-setup` | Verify designer-skills + prd-generator installed | `mc-setup-skills` if missing | journal |
| 1 | `braindump` | Capture feature + codebase paths | — | `features/{slug}/braindump.md`, status.json |
| 2 | `explore` | Codebase map per target | `mc-explore` × N | `explore/{label}.md`, journals |
| 3 | `research` | UX research synthesis | **`design-research`** (required) | `features/{slug}/research.md`, journal |
| 4 | `clarify` | AskQuestion loop | orchestrator | `journal/NNN-clarify.md` |
| 5 | `strategy` | IA / problem frame | **`ux-strategy`** when ambiguous | `features/{slug}/ux-strategy.md` |
| 6 | `prd` | Write PRD | `mc-prd` + **`prd-generator`** (required) | `spec.md`, journal |
| 7 | `interaction` | Flows, states, errors | **`interaction-design`** for UI features | `features/{slug}/interaction.md` |
| 8 | `mock` | Wireframes | `mc-mock` + **`visual-critique`** before approve | `layout/**`, journal |
| 9 | `plan` | Platform plans | `mc-platform-plan` | `phases/phase-*.md`, tasks[] |
| 10 | `build` | Implement tasks | subagent-driven-development | commits, build journals |
| 11 | `validate` | Gates + e2e | validator + BUILD-GATES | validate journal |
| 12 | `done` | — | — | pipelineStage: done |

**Tech-stack features:** skip mock, interaction, visual-critique; flow braindump → explore → clarify → prd → plan → build → validate.

---

## Design skill touchpoints

| Before approving mock | Invoke |
|---------------------|--------|
| Layout hierarchy | `visual-critique` or `/visual-critique:critique-screen` |
| Navigation / states | `interaction-design` |
| Research gaps | `design-research` |

Document skill outputs in feature folder — do not keep design decisions only in chat.

---

## Context routing (Add Feature)

| Stage | Read | Skip |
|-------|------|------|
| explore | braindump, target repo paths | project/market-brief, other features |
| research | braindump, explore summaries | phase plans |
| prd | braindump, explore/*, research, clarify journal | unrelated features |
| mock | spec.md, interaction.md, layout targets | market briefs |
| plan | spec.md, stack.json, explore maps | competitor docs |
| build | single task + BUILD-GATES commands | full portfolio |

---

## Continuous run

Same as v3: orchestrator advances stages in **one session** without telling the user to open a new chat. See `ORCHESTRATOR.md`.

---

## Exit criteria

Feature is **done** when:

1. All phases validated per BUILD-GATES.md
2. E2E evidence when UI introduced
3. `pipelineStage: done` in status.json
4. Dashboard regenerated
