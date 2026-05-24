# Router — Mission Control v4

The orchestrator **classifies intent first**, then runs exactly one workflow. Do not merge Project START and Add Feature into a single generic pipeline.

---

## Entry classification

| User intent | Command | `workflowType` | Required vendor bundle |
|-------------|---------|----------------|------------------------|
| New product / new app foundation | `/mc-start` | `project-start` | `startup-skill` |
| New capability in existing product | `/mc-feature` | `add-feature` | `designer-skills`, `prd-generator` |
| Resume from disk | `/mc` | read from `state.json` | per active workflow |
| Upgrade kit safely | `/mc-upgrade` | — | none |
| Tech stack only (legacy) | `/mc-init` | — | none |
| Portfolio ordering | `/mc-portfolio` | — | none |

**Legacy:** `/mc-braindump` → treat as `/mc-feature` unless the user explicitly describes a new product/market.

---

## Router algorithm

```
1. READ state.json, HANDOFF.md, active status.json
2. If user command is /mc-start → workflowType = project-start
3. If user command is /mc-feature or /mc-braindump → workflowType = add-feature
4. If /mc resume → use state.json.workflowType + pipelineStage
5. CHECK vendor skills for workflowType (see SKILL-DEPENDENCIES.md)
   → missing? dispatch mc-setup-skills FIRST, then continue
6. BUILD route card (see below)
7. DISPATCH first stage subagent with context packet ONLY
8. LOOP until done / BLOCKED / user pause
```

---

## Route card (required before every subagent dispatch)

Write or update `control/routes/{session-id}.md` or embed in the dispatch prompt:

```markdown
## Route card
- workflow: project-start | add-feature
- stage: {pipelineStage}
- subagent: {name}
- read: [exact paths]
- skip: [explicit paths / folders]
- skills: [required skill invocations]
- outputs: [disk artifacts this step must produce]
- gates: [lint/build/test commands if build stage]
- stop: DONE | BLOCKED | clarify
```

The orchestrator must **never** paste the entire portfolio, all journals, or unrelated feature specs into a subagent prompt.

---

## Workflow docs

| Workflow | Pipeline doc |
|----------|--------------|
| Project START | `PROJECT-START-PIPELINE.md` |
| Add Feature | `ADD-FEATURE-PIPELINE.md` |

Shared rules: `ORCHESTRATOR.md`, `CONTEXT-PACKETS.md`, `BUILD-GATES.md`, `JOURNAL-RULES.md`, `AGENT-DATA-RULES.md`.
