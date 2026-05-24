# Agent data rules (Mission Control v3)

**Every Mission Control stage MUST follow this document.** Disk is the portfolio; chat context is incomplete.

**Also read:** `JOURNAL-RULES.md` (subagent documentation), `PIPELINE.md` (step catalog), `ORCHESTRATOR.md` (orchestrator-only model).

## Golden rule: add, never erase the portfolio

When the user describes a **new** feature, idea, or braindump:

1. **Recognize it as new** — a new outcome or scope that does not replace an existing `features/{slug}/` folder unless the user explicitly says to rename, merge, or delete a feature.
2. **Add** a new `features/{slug}/` folder (or update the one slug you are working on).
3. **Never delete or overwrite** other items' folders, specs, plans, tasks, artifacts, or status.

If unsure: **tech stack vs UX feature** → see `WORKSTREAMS.md` and ask via the structured tool. **New vs existing slug** → ask before writing.

---

## Before any write: read the portfolio

Every session that touches Mission Control **must** read first:

| Read | Why |
|------|-----|
| `{CONTROL_ROOT}/features/*/` (exclude `_template`) | UX features on disk |
| `{CONTROL_ROOT}/tech-stack/*/` (exclude `_template`, `stack.json`) | Setup items on disk |
| `{CONTROL_ROOT}/tech-stack/stack.json` | Established stack context |
| `{CONTROL_ROOT}/state.json` | Merge global state; do not replace with defaults |
| `{CONTROL_ROOT}/HANDOFF.md` | Preserve cross-feature context |
| Active feature's `status.json` | Patch fields; do not reset tasks |

**List features on disk.** Do not assume the chat is the only feature in the project.

---

## New feature detection

Treat as a **new feature** (scaffold new folder) when:

- User runs `/mc-braindump` with a new idea and the slug does not exist yet
- User describes a second product outcome, user journey, or capability that belongs in its own spec
- Batch braindump splits one message into multiple slugs

Treat as **update existing** (edit that slug only) when:

- User runs `/mc-refine {slug}`, `/mc-layout {slug}`, `/mc-plan {slug}`, `/mc-build` for a known slug
- User explicitly says they are changing an existing feature

**Never** "start fresh" by deleting other slugs or wiping `features/` because the chat only discussed one idea.

---

## Per-file rules

### `tech-stack/{slug}/` (setup items)

Same additive rules as features. No `layout/` folder. Append to `techStackOrder` in `state.json`.

### `features/{slug}/` (UX)

| Action | Rule |
|--------|------|
| New slug | Copy from `_template/`; write only under `{slug}/` |
| Existing slug | Read `spec.md`, `status.json`, `phases/`, `layout/` first; patch in place |
| `status.json` | Update fields for this feature only; **never clear** `tasks[]` unless user explicitly resets the plan |
| `tasks[]` | Append or update task rows; do not remove completed tasks |
| Other slugs | **Hands off** — do not edit, delete, or rename without explicit user instruction |

### `state.json` (global)

**Always read → merge → write.** Never write a fresh default object.

| Field | On new feature | Rule |
|-------|----------------|------|
| `activeFeature` | Set to the slug you are working on now | OK to change |
| `phase` | Set to current stage | OK to change |
| `buildOrder` | **Append** UX slugs | UX features only |
| `techStackOrder` | **Append** tech slugs | Setup items only |
| `portfolioReviewStatus` | Leave as-is until portfolio run; set `"draft"` if new UX slug added after approval | Do not reset to `null` when adding a feature unless user resets portfolio |
| `devServers`, `backgroundShells` | Preserve | Do not clear when braindumping |
| `currentTaskId`, `branch` | Update for build sessions | OK |

Example merge (conceptual):

```json
// WRONG — destroys portfolio
{ "activeFeature": "new-thing", "phase": "refinement", "buildOrder": [] }

// RIGHT — adds feature, keeps siblings
{ "...existing fields...", "activeFeature": "new-thing", "phase": "refinement", "buildOrder": ["existing-a", "existing-b", "new-thing"] }
```

If `buildOrder` is empty and only one feature exists, you may set `buildOrder: ["that-slug"]`.

When a **second** approved spec appears and `portfolioReviewStatus` is not `"approved"`, leave ordering for `/mc-portfolio` — do not delete the first slug from disk or from docs.

### Build order enums (`state.json`)

Ordering is **dependency-based** — analyzed and approved via **`/mc-portfolio`** + **`spec-portfolio-review`** skill (not ad-hoc in chat).

| Field | Type | Meaning |
|-------|------|---------|
| `buildOrder` | `string[]` | UX feature slugs in build sequence. Index `0` = build first; dashboard shows as **#1**, **#2**, … |
| `techStackOrder` | `string[]` | Tech-setup slugs in sequence (from `/mc-init` or `/mc-braindump`; no portfolio gate) |
| `portfolioReviewStatus` | enum | `null` — not reviewed · `"draft"` — slugs listed but user has not approved via `/mc-portfolio` · `"approved"` — canonical order locked |

**Dashboard display:** regenerate after `/mc-portfolio` approval — **Build order** panel lists numbered UX features + tech setup. Card grid shows `#N` badges; default sort is build order when `portfolioReviewStatus` is `"approved"`.

**Rules:**

- `/mc-portfolio` must set `buildOrder` to **every** UX slug (exclude `_template`) in dependency order.
- Do not reorder silently when braindumping — append new slugs; set `portfolioReviewStatus` to `"draft"` if it was `"approved"` and a new UX feature was added.
- Per-item `order` in dashboard data is **1-based position** in `buildOrder` or `techStackOrder`, or `null` if unlisted.

### `dashboard.html`

| Rule | Detail |
|------|--------|
| **Never edit by hand** | Agents must not rewrite dashboard HTML in the editor |
| **Always regenerate** | Run `node {CONTROL_ROOT}scripts/generate-dashboard.mjs` |
| **Embedded content** | Spec, plans, braindump, explore docs, journal entries, wireframes (srcdoc), and e2e screenshots (base64) are embedded at generation time — dashboard works standalone without file links |
| **Source of truth** | The script reads **all** folders under `features/` — regeneration includes every feature on disk |

If the dashboard looks wrong, fix `state.json` / `status.json` / feature folders, then regenerate. Do not paste a one-feature dashboard.

### `HANDOFF.md`

- Update for the **current** session (active slug, phase, next command).
- **Mention other features** when relevant (e.g. "Portfolio: feature-a approved, feature-b draft — run /mc-portfolio before layout").
- Do not replace the file with content that implies only one feature exists when others are on disk.

### `SPEC-PORTFOLIO-REVIEW.md`

- **Feature inventory** must list **every** approved spec on disk.
- Portfolio review **updates** this file holistically; never write a review that omits existing features.
- On `/mc-portfolio`, read all `features/*/spec.md` — not only the feature from chat context.

---

## Task completion (`status.json` → `tasks[]`)

When an agent **starts** a task: set `status` to `"in-progress"` (only one per item at a time).

**Subagent journal (v3):** before marking a build task `done`, ensure `journal/NNN-build-{task-id}.md` exists per `JOURNAL-RULES.md`. Optionally set `tasks[].journalFile`.

**Pipeline steps (v3):** update `steps[]` and `pipelineStage` when each pipeline stage completes (braindump → explore → clarify → prd → mock → plan → build → validate).

**While e2e or validation is failing:** keep the task `"in-progress"`. Do not set `"done"` or record a commit until e2e exit 0 and the task commit succeeds.

When e2e passes and the task is **committed**:

| Field | Value |
|-------|--------|
| `status` | `"done"` |
| `commit` | Full git SHA |
| `commitMessage` | `git log -1 --pretty=%s` |
| `updatedAt` | ISO date |

**E2e screenshots:** only when `state.json` → `captureE2eScreenshots` is `true` (user chose via AskQuestion at build session start). Save to `features/{slug}/artifacts/{task-id}/` or `tech-stack/{slug}/artifacts/{task-id}/`.

The dashboard shows **Working now** for `in-progress` tasks and copy buttons for commit hash + message on done tasks.

---

## After every milestone

1. Patch only the files for the feature(s) you touched.
2. Merge `state.json` (rules above).
3. Update `HANDOFF.md`.
4. Regenerate dashboard:

```bash
node docs/superpowers/control/scripts/generate-dashboard.mjs
```

5. Confirm mentally: **does `features/` still contain every slug that existed before this session?** If not, stop and restore before continuing.

---

## Explicitly forbidden

- Deleting `features/{other-slug}/` or any file inside it without user request
- Replacing `state.json` with the template from memory
- Clearing `buildOrder`, `tasks`, or portfolio fields to "simplify"
- Hand-editing `dashboard.html` instead of running the generator
- Writing a spec that replaces another feature's scope without merge/rename confirmation
- Assuming zero features exist because the current chat started empty

---

## User-initiated removal only

Remove or archive a feature **only** when the user explicitly asks to delete, merge, or archive that slug. Then:

1. Confirm via ask tool which slug(s) are affected.
2. Remove only the named slug(s).
3. Remove those slugs from `state.json` → `buildOrder`.
4. Regenerate dashboard and update `HANDOFF.md` / portfolio review.

Default behavior is **additive**.
