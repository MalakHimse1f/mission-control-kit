# MediaFlow Mock Project — Design

**Date:** 2026-05-26
**Status:** Approved
**Scope:** Replace the generic `sample-project/control/v5/` features (team-collab, user-onboarding, notifications, dark-mode) with MediaFlow features so the v5 dashboard and brainstorming demos use a realistic product.

## Product

**MediaFlow** is a personal media ownership and backlog tracker. A single user manages their own library across five media types: books, comic books, movies, TV shows, and video games.

- **Target user:** individual hobbyist (no social/sharing, no family/multi-profile)
- **Platform:** web app, mobile-responsive (no native mobile apps)
- **Core value:** "What do I own, what's in my backlog, and what should I touch next?"

## Feature Set

Four features, one per pipeline state:

| # | Slug | State | Phase active |
|---|------|-------|--------------|
| 1 | `personal-library-import` | `needs-input` | Architecture (in-progress, decision pending) |
| 2 | `backlog-prioritization` | `ready` | All complete; awaiting build dispatch |
| 3 | `progress-tracker` | `in-progress` | Build (3 of 7 tasks done) |
| 4 | `cross-media-search` | `complete` | Done |

### 1. personal-library-import — needs-input

**Pitch:** Bulk-add existing collections from sources the user already has. Supports Goodreads CSV, Letterboxd export, Steam library, Open Library, manual CSV.

**UX phase:** complete. Decisions saved:
- Source picker pattern → `wizard-stepped` (vs. `unified-dropzone`, `source-list`)
- Conflict handling on dupes → `inline-review` (vs. `batch-report`, `silent-skip`)

**UI phase:** complete. Decisions saved:
- Surface placement → `dedicated-page` (vs. `settings-tab`, `modal-flow`)
- Progress display during long imports → `inline-progress-bar`

**Architecture phase:** **in-progress.** One decision saved (transport via `oauth-redirect`), one pending: source connector pattern. Options:
- `plugin-modules` — each source is its own module; new sources added by dropping a file
- `monolithic-service` — one importer with switch-case per source; simpler
- `serverless-functions` — each source is a Cloud Function; isolation + cost

**Deferred questions:** "Should we rate-limit per-source independently or have a global token bucket?" raised during UX, deferred to Architecture.

**Artifacts seeded:**
- `status.json`, `decisions.json`, `spec.md`, `braindump.md`
- `ux-flow.html` (rendered import wizard flow using Task-1 ux-flow primitive)
- `architecture-diagram.html` (plugin vs. monolith vs. serverless using Task-1 architecture primitive, no option selected)

### 2. backlog-prioritization — ready

**Pitch:** "What should I play/watch/read next?" widget on the home dashboard. Combines user-pinned items with algorithmic ranking by recency, completion likelihood, and series continuity.

All three phases complete:
- UX: hybrid ranking (user pin overrides + algorithmic suggestions below), "next up" surfaces as a dashboard widget
- UI: card grid with cover art + progress bar + dismiss button
- Architecture: server-side scoring on a nightly cron with cached results; client reads pre-computed scores

**Artifacts:** `status.json`, `decisions.json` (all complete), `spec.md`, `braindump.md`.

### 3. progress-tracker — in-progress

**Pitch:** Track where you are: page/chapter for books, episode for series, hours/achievements for games. Cross-media unified progress model.

All three decision phases complete. Build phase active with `phases/phase-1.md` showing seven tasks:
1. ✅ `progress.model.ts` (data model + types)
2. ✅ `progress.view.tsx` (read-only progress widget)
3. ✅ Server sync endpoint
4. 🔄 `progress.viewmodel.ts` (state + actions) — *in progress*
5. ⏳ Episode-level tracking for TV
6. ⏳ Notification when stagnant for 30 days
7. ⏳ Conflict resolution when progress recorded on two devices

Follows MVVM (Task-12 enforcement) — file naming + layer separation visible in the task list.

**Artifacts:** `status.json` (with `tasks` array, 3 done / 1 in-progress / 3 pending), `decisions.json` (all complete), `spec.md`, `braindump.md`, `phases/phase-1.md`.

### 4. cross-media-search — complete

**Pitch:** Universal search across the user's library and external catalogs (TMDB for movies/TV, IGDB for games, Open Library for books, Comic Vine for comics). Results group by media type with quick-add to backlog.

All phases complete, shipped. `status.json` shows `stage: complete`.

**Artifacts:** `status.json`, `decisions.json`, `spec.md`, `braindump.md`.

## File Plan

Under `sample-project/control/v5/`:

```
state.json                                  (updated to list MediaFlow features)
README.md                                   (updated — describes MediaFlow)
_diagram-assets/                            (unchanged — still copies of _shared/)
features/
  personal-library-import/
    status.json
    decisions.json
    spec.md
    braindump.md
    ux-flow.html              ← rendered from Task-1 primitive
    architecture-diagram.html ← rendered from Task-1 primitive
  backlog-prioritization/
    status.json
    decisions.json
    spec.md
    braindump.md
  progress-tracker/
    status.json
    decisions.json
    spec.md
    braindump.md
    phases/
      phase-1.md
  cross-media-search/
    status.json
    decisions.json
    spec.md
    braindump.md
```

## Deletions

The four existing feature directories are removed:
- `sample-project/control/v5/features/team-collab/`
- `sample-project/control/v5/features/user-onboarding/`
- `sample-project/control/v5/features/notifications/`
- `sample-project/control/v5/features/dark-mode/`

## Test impact

- `tests/v5-e2e.test.mjs` currently asserts the four old slugs are returned by `/api/v5/features` and POSTs to `team-collab`. Update slug references to MediaFlow features:
  - The "all four features returned" assertion now expects `personal-library-import, backlog-prioritization, progress-tracker, cross-media-search`
  - The POST round-trip target becomes `personal-library-import` (it's the one with a pending architecture decision; changing its selection matches the demo flow)
- `tests/v5-dashboard-render.test.mjs` does not hardcode slugs; verify no other tests reference the old slugs.

## Acceptance criteria

1. `sample-project/control/v5/features/` contains exactly the four MediaFlow features above. No stale references to old slugs.
2. Each `decisions.json` validates against `lib/v5/decisions-schema.mjs`.
3. `personal-library-import` decisions show: UX complete, UI complete, Architecture in-progress with one decision saved and one `pending` entry, one `deferred` question.
4. `progress-tracker/status.json` has a `tasks` array with 3 done / 1 in-progress / 3 pending matching the spec.
5. Launching v5 dashboard server at `sample-project/control/v5/` shows MediaFlow features in the right pipeline buckets.
6. `npm test` passes with the updated E2E slugs.
7. Feature spec markdown reads like a real PRD (50-100 lines each, plausible voice).
8. Generated `ux-flow.html` and `architecture-diagram.html` for `personal-library-import` open standalone in a browser and have working selection (they use the Task-1 primitives).
