# Workflow controls

Build and plan routing toggles live in **`.mc/orchestrator-controls.json`** alongside orchestrator automation settings. Set them from the dashboard **Workflow controls** panel (requires `dashboard-server.mjs`).

Orchestrator and build subagents **must read this file every `/mc` session** when `pipelineStage` is `plan` or `build`.

---

## Build modes (`buildWorkflow.mode`)

| Mode | Vendor skills | Review subagents | Typical use |
|------|---------------|------------------|-------------|
| **`sdd+tdd`** (default) | `subagent-driven-development`, `test-driven-development` | Per `reviewChain` | Production features — isolated implementers + TDD discipline |
| **`sdd`** | `subagent-driven-development` only | Per `reviewChain` | SDD orchestration; tests still required via BUILD-GATES |
| **`tdd-lite`** | `test-driven-development` only | **None** | Faster iteration — one implementer per task, TDD inside, no spec/quality reviewer subagents |

### Review chain (`buildWorkflow.reviewChain`)

Applies to **SDD modes only**. Ignored when mode is `tdd-lite` (always `none`).

| Value | Per-task flow |
|-------|----------------|
| **`full`** | implementer → spec reviewer → quality reviewer → BUILD-GATES → commit |
| **`spec-only`** | implementer → spec reviewer → BUILD-GATES → commit |
| **`none`** | implementer → BUILD-GATES → commit |

BUILD-GATES (lint, compile, test, build evidence) always apply unless a task explicitly documents why a gate is N/A.

---

## Plan execution (`planWorkflow.mode`)

| Mode | Behavior |
|------|----------|
| **`subagent-driven`** (default) | `mc-platform-plan` subagent writes phases; build continues in the **same orchestrator session** |
| **`executing-plans`** | Same plan subagent; after plan approval, user **may** open a parallel session using Superpowers `executing-plans` for batch execution |

Plan mode does not skip `mc-platform-plan` — it documents what happens **after** the plan exists.

---

## Router integration

`lib/mc-router.mjs` → `getStageVendorSkills(workflowType, stage, controls)` reads:

- **build** → `resolveBuildVendorSkills(controls)`
- **plan** → `resolvePlanVendorSkills(controls)`

Pickup prompts embed the active mode via `dashboard-data.mjs` → `buildWorkflowPromptLines()`.

---

## Example JSON

```json
{
  "buildWorkflow": {
    "mode": "sdd+tdd",
    "reviewChain": "full"
  },
  "planWorkflow": {
    "mode": "subagent-driven"
  }
}
```

---

## Related docs

- `ORCHESTRATOR-CONTROLS.md` — ralph loop, auto-advance
- `BUILD-GATES.md` — per-task verification
- `SKILL-DEPENDENCIES.md` — required vendor bundles
- `skills/mc-build/SKILL.md` — orchestrator build loop (must honor active review chain)
