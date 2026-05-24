# Pipeline — Mission Control v4

Mission Control v4 has **two primary pipelines** plus shared build validation. See `ROUTER.md` for classification.

---

## Workflow A — Project START

**Doc:** `PROJECT-START-PIPELINE.md`  
**Command:** `/mc-start`  
**Vendor:** startup-skill

```
vendor-setup → braindump → validate → compete → position → platforms → stack → portfolio → launch-prep → done
                                                                              ↓
                                                                    /mc-feature per slug
```

Disk root: `control/project/` (product-level artifacts, not a feature slug).

---

## Workflow B — Add Feature

**Doc:** `ADD-FEATURE-PIPELINE.md`  
**Command:** `/mc-feature`  
**Vendor:** designer-skills

```
vendor-setup → braindump → explore → research → clarify → strategy → prd → interaction → mock → plan → build → validate → done
```

Tech-stack variant skips: research (optional), interaction, mock, visual-critique.

---

## Shared build substeps

```
build task → implementer → spec review → quality review → BUILD-GATES → commit → journal
phase end → e2e (E2E-TOOLS.md) → validate
```

---

## state.json fields (v4)

```json
{
  "workflowType": "project-start | add-feature",
  "projectStartStage": "validate | compete | ... | done",
  "activeFeature": "session",
  "phase": "build",
  "techStackStatus": "established",
  "buildOrder": [],
  "captureE2eScreenshots": false
}
```

Feature-level `status.json` still tracks `pipelineStage` and `steps[]` per `ADD-FEATURE-PIPELINE.md`.

---

## Step catalog (Add Feature)

Each feature maintains `steps[]` — dashboard renders timeline. Include v4 steps:

`vendor-setup`, `braindump`, `explore`, `research`, `clarify`, `strategy`, `prd`, `interaction`, `mock`, `plan`, `build`, `validate`, `done`

Omit `mock` / `interaction` for tech-stack items.

---

## Pickup at any point

Read: `HANDOFF.md`, `state.json`, active `status.json`, `journal/`, `dashboard.html`.

Continue from recorded stage — do not restart workflow unless user asks.

---

## Portfolio

`/mc-portfolio` sets `buildOrder[]` when 2+ UX specs approved. Does not replace per-feature pipeline.
