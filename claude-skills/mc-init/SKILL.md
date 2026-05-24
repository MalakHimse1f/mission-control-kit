---
name: mc-init
description: "Mission Control — establish tech stack context (required before braindump). Usage: /mc-init"
---

# Mission Control — Init (tech stack context)

**Run first** when Mission Control is new or `tech-stack/stack.json` → `techStackStatus` is null.

**MUST invoke:** `mission-control` skill.

**MUST read:** `docs/superpowers/control/WORKSTREAMS.md` and `docs/superpowers/control/AGENT-DATA-RULES.md`.

## Goal

Separate **tech stack** (app setup) from **features** (user-facing UX). After init, the dashboard **Tech stack** section shows context; each setup item and UX feature gets its own spec and task list.

## Part A — Detect project mode

1. Read `state.json` and `tech-stack/stack.json`. If `techStackStatus` is `"established"`, tell user init is done and point to `/mc-braindump`.
2. Run: `node docs/superpowers/control/scripts/detect-stack.mjs` and read JSON output.
3. **Ask via the tool:** "Is this an existing codebase or a brand-new project?"
   - Options framed for PM/UX: **Existing app** (code already here) vs **Starting from scratch** (greenfield)
   - Use detection output to pre-select when obvious (`likelyExisting: true` → suggest Existing)

## Part B — Existing project

1. Summarize detected platforms/frameworks and **`suggestedLayoutTargets`** from `detect-stack.mjs` in plain language.
2. **Ask via the tool:** confirm stack summary and **surfaces** (layout targets — labels from `tech-stack/LAYOUT-TARGETS.md`, `allow_multiple: true`). **Only time platform is asked.**
3. Write `tech-stack/stack.json`: `projectMode: "existing"`, `techStackStatus: "established"`, `establishedAt`, `summary`, `platforms`, `frameworks`, **`layoutTargets`**, `detectedFromRepo`.
4. Write `tech-stack/CONTEXT.md` — short human-readable stack doc for future agents.
5. Merge `state.json`: `projectMode: "existing"`, `techStackStatus: "established"`, `phase: "idle"`.
6. **Do not** create tech-stack item folders unless user mentions missing setup work in this session.
7. Update `HANDOFF.md`, regenerate dashboard.

## Part C — Greenfield project

Order: **UX features first (names only), then tech stack, then setup specs.**

1. **Ask via the tool:** "What are the main things users will be able to do in this app?" (allow_multiple or follow-up questions) — capture feature **names**, not implementation.
2. For each UX outcome, scaffold `features/{slug}/` from `_template/` with a **one-line sketch** in `spec.md`, `specStatus: "draft"`.
3. **Ask via the tool:** which **surfaces** the app will ship on — use labels from `tech-stack/LAYOUT-TARGETS.md` (e.g. Web app, iPhone bottom tabs). `allow_multiple: true`. Store IDs in **`layoutTargets`**. **Only `/mc-init` may ask this — never again in layout or braindump.**
4. **Ask via the tool:** frameworks/tooling if not already clear (Next.js, Swift, etc.) — optional second question if needed.
5. Write `tech-stack/stack.json` and `tech-stack/CONTEXT.md` (include `layoutTargets` in both).
6. **Ask via the tool:** which **setup items** are needed before UX work (e.g. scaffold Next.js, scaffold iOS app).
7. For each setup item, scaffold `tech-stack/{slug}/` from `_template/` with sketch `spec.md`, `specStatus: "draft"`.
8. Merge `state.json`:
   - `projectMode: "greenfield"`, `techStackStatus: "established"`
   - `techStackOrder`: ordered tech slugs
   - `buildOrder`: append UX feature slugs (draft ok)
9. Update `HANDOFF.md`, regenerate dashboard.

## Session boundary

```
Tech stack context established.

Open docs/superpowers/control/dashboard.html — see Tech stack and Features sections.

Greenfield: refine setup items first, then UX features.
  /mc-braindump (or /mc-refine {slug}) for each tech-stack item
  then /mc-plan {slug} → /mc-build for tech items (no layout)

UX features after relevant tech setup:
  /mc-braindump or /mc-refine → /mc-layout → /mc-plan → /mc-build

Existing project: /mc-braindump for the next tech or UX item.

Continue in this session — run /mc-braindump or /mc to start the next feature. Optional: /mc-handoff
```

## Do NOT

- Skip init and go straight to feature braindump when `techStackStatus` is null
- Put scaffold/setup specs under `features/`
- Put user-facing flows under `tech-stack/`
- Delete existing `features/` or `tech-stack/` siblings
- Ask platform/surface questions outside this command (layout and braindump must read `layoutTargets` instead)
