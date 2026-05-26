# Progress Tracker — Phase 1 Build Plan

Build phase 1 implements the MVVM core of the progress tracker plus the
server-side sync endpoint. MVVM file naming (Task-12 enforcement) is mandatory:
each layer lives in its own file.

## Tasks

### T1 — `progress.model.ts` (data model + types) — ✅ done
Define the `ProgressRecord` type, the per-media `details` shapes (book, tv,
game, movie, comic), and the discriminated union. Pure type module; no logic.
- **Files:** `src/features/progress/progress.model.ts`
- **Tests:** `progress.model.test.ts` — type-level assertions only
- **Done:** 2026-05-12

### T2 — `progress.view.tsx` (read-only widget) — ✅ done
Render the horizontal progress bar with numeric label. Props-in only — no
state, no API calls. Accepts a `ProgressRecord` and emits a callback on
+1/-1 click for the parent to handle.
- **Files:** `src/features/progress/progress.view.tsx`
- **Tests:** `progress.view.test.tsx` — snapshot + interaction test for the
  step controls
- **Done:** 2026-05-15

### T3 — Server sync endpoint — ✅ done
`POST /api/progress` accepting `{ itemId, mediaType, details }` and returning
the persisted `ProgressRecord`. Idempotent on `(itemId, clientUpdateAt)`.
Applies the `max(local, remote)` server-side rule for the relevant numeric
field per media type.
- **Files:** `server/routes/progress.ts`, `server/services/progress-sync.ts`
- **Tests:** `progress-sync.test.ts` — covers conflict resolution and
  idempotency
- **Done:** 2026-05-19

### T4 — `progress.viewmodel.ts` (state + actions) — 🔄 in progress
Wire the view to the API. Owns local state, optimistic updates,
debounce on rapid +1 clicks, error rollback. Exposes a `useProgress(itemId)`
hook the view consumes via props from its container.
- **Files:** `src/features/progress/progress.viewmodel.ts`
- **Tests:** `progress.viewmodel.test.ts` — optimistic-update, rollback,
  debounce
- **Status:** in progress; debounce timing under discussion (200ms vs 500ms)

### T5 — Episode-level tracking for TV — ⏳ pending
Extend the `details` shape for `media_type: "tv"` to include `season` +
`episode`. Add a "next episode" affordance to the view. Hits TMDB to know
the max aired episode.
- **Files:** `src/features/progress/details/tv.ts`, view extension
- **Tests:** view snapshot + TMDB stub for max-episode lookup
- **Depends on:** T4

### T6 — Stagnation notification (30-day inactivity) — ⏳ pending
Nightly cron scans for in-progress items with no update in 30 days. Emits a
single notification per item (dedup) prompting continue/pause/abandon.
- **Files:** `server/jobs/progress-stagnation.ts`
- **Tests:** scheduling test with synthetic dates
- **Depends on:** T3

### T7 — Multi-device conflict resolution — ⏳ pending
Server-side rule already in T3 (`max(local, remote)`) is the v1 behavior.
T7 adds an audit row when the conflict is non-trivial (e.g. > 10 pages
divergence) so we can detect noisy users for v2.
- **Files:** `server/services/progress-sync.ts` (extension), audit table
  migration
- **Tests:** audit-row emission test
- **Depends on:** T3

## Sequence

T1 → T2 → T3 done sequentially. T4 in progress, blocks T5. T6 + T7 can run in
parallel after T4 lands.

## Definition of done (phase)

- All seven tasks complete and merged.
- E2E test covers two browser sessions hitting the same item with offset
  progress; final state is correct on both.
- Documentation in the user-facing changelog.
