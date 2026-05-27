---
name: mc-layout
description: "Mission Control — wireframe layout after spec, before plan. Usage: /mc-layout <feature-slug>"
disable-model-invocation: true
user-invocable: false
---

# Mission Control — Layout

**First:** Load the `mission-control` skill, then load the `mc-layout` skill (Skill tool).

**MUST read:** `AGENT-DATA-RULES.md`, `tech-stack/LAYOUT-TARGETS.md`.

## Feature slug

$ARGUMENTS

## Prerequisites

- Slug under **`features/{slug}/`** — UX only (tech-stack skips layout)
- `specStatus: "approved"`
- **`tech-stack/stack.json`** → `techStackStatus: "established"` and **`layoutTargets`** non-empty
  - If missing: tell user to run **`/mc-init`** — **do not ask platform here**

## Platform rule (HARD GATE)

**Never ask which platform or device targets.** Platforms were set at `/mc-init`.

Read `tech-stack/stack.json` → `layoutTargets[]` and use those skeleton IDs for wireframes. See `tech-stack/LAYOUT-TARGETS.md`.

## This session only

1. Read `tech-stack/stack.json`, `CONTEXT.md`, feature `spec.md`, `control/layout/selection/SELECTION-UI.md`.
2. Ask **feature-specific** questions only (one at a time, structured ask tool):
   - Primary user path for **this feature**
   - Screens/views for **this feature**
   - Navigation within **this feature** (tabs, links, sheets — not which OS/platform)
   - If ambiguous: new app vs new feature in existing app (infer from `projectMode` when possible)
3. Copy `control/layout/selection/template.html` for each `layoutTargets` entry and follow `SELECTION-UI.md`.
4. Write `layout/layout.md`, `platforms.json` (include `"fromStack": true`, `"layoutTargets"` copied from stack), `wireframes/*.html`.
5. `layoutStatus: "approved"`; update HANDOFF + regenerate dashboard.

## Do NOT

- Ask web/iOS/Android/desktop or framework choice — **forbidden outside `/mc-init`**
- Write plans or code; use brand styling

## Session boundary

```
Layout approved for `{slug}`.

Layout: docs/superpowers/control/features/{slug}/layout/

new session → /mc-plan {slug}
Optional: /mc-handoff
```
