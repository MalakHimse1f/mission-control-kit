# Context packets — Mission Control v4

**Invariant:** Subagents receive **complete task context**, not **complete project context**.

v3 said "full context in prompt." v4 replaces that with a **context packet** assembled by the orchestrator from disk.

---

## Packet structure

Every subagent dispatch includes:

```markdown
## Context packet — {subagent} — {feature-or-project slug}

### Task
One paragraph: what this agent must produce.

### Read (only these)
- path/to/file.md — reason
- excerpt or section if file is large

### Skip (do not load)
- features/other-slug/**
- journals unrelated to this task
- vendor/** unless this agent installs skills

### Skills to invoke
- /startup:startup-design — market validation
- /design-research:discover — user research synthesis

### Constraints
- read-only | balanced | build
- platform(s): web | ios | android
- success criteria (from BUILD-GATES.md if build)

### Outputs
- exact disk paths to write
- journal file name

### Stop condition
DONE | DONE_WITH_CONCERNS | BLOCKED
```

---

## Defaults by subagent

| Subagent | Read | Skip |
|----------|------|------|
| **mc-setup-skills** | `SKILL-DEPENDENCIES.md`, `vendor/manifest.json` | all feature specs |
| **mc-explore** | braindump, `{slug}/explore/` template, target codebase tree | other features, plans, mock HTML |
| **mc-prd** | braindump, explore/*.md, clarify journal, `_template/spec.md` | phase plans, unrelated features | **invoke:** `prd-generator` |
| **mc-mock** | approved spec.md, layout targets, relevant explore notes | build plans, other features |
| **mc-platform-plan** | approved spec.md, stack.json, explore maps for target platforms | market briefs, design critique from other slugs |
| **implementer** | one task from phase-*.md, touched files list, BUILD-GATES commands | full PRD unless task references section |
| **spec-reviewer** | task spec, diff, acceptance criteria | explore journals |
| **quality-reviewer** | diff, BUILD-GATES results, conventions excerpt | PRD narrative |
| **validator** | spec acceptance, test inventory, E2E-TOOLS.md for layoutTarget | implementation plans |

---

## Orchestrator rules

1. **Fresh subagent** per dispatch — no orchestrator chat history in worker prompt.
2. **Prefer excerpts** over whole files when >300 lines; cite line ranges.
3. **Hub stays lean** — orchestrator reads journal *summaries*, not full worker logs, when advancing stages.
4. **Long build loops** — consider headless worker sessions (Eric Tech pattern) so orchestrator context does not accumulate build output.

---

## Journal requirement

Each journal's **Inputs received** section must list the packet paths the subagent was given. This audits routing compliance.
