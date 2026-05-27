# Progress Tracker — Spec

## Overview
A unified progress-tracking system that works across every media type MediaFlow
supports. Books expose page or chapter; TV shows expose episode (season +
episode #); movies are binary (started/finished); games expose hours and, where
available, achievements. One data model, one widget, one set of update
affordances — so the user never has to learn "how do I track *this* media type"
twice.

## Goals
- Single ProgressRecord model that supports five media types without breaking
  abstraction.
- Inline progress update on any item card — one click increments.
- Cross-device: progress logged on the web app is visible immediately on
  mobile-web and vice versa.
- Detect stagnation: if a user hasn't touched an in-progress item for 30 days,
  surface a gentle "still reading this?" prompt.

## Non-goals
- Reading-time prediction ("you'll finish this in 4 hours") — future enhancement.
- Achievement tracking for non-game media (no "reading streaks" or
  badge systems in v1).
- Public progress sharing.

## User stories
1. As a reader, I'm on page 247 of a 412-page book. I click the inline stepper
   on the book card and bump to page 250. The widget updates immediately.
2. As a TV watcher, I just finished S3E7. I click "next episode" on the card
   and the tracker records S3E8 as next-up.
3. As a gamer with a Steam-imported title, my play-hours arrive pre-populated
   from the import. I can manually adjust without breaking the Steam sync.
4. As a user on two devices, an update on my laptop appears on my phone within
   seconds (and vice versa).
5. As a user with a stagnant in-progress item, I get a polite "still on this?"
   notification 30 days after last touch with options to continue, pause, or
   abandon.

## UX decisions (locked)
- Unit display: **both** — native unit primary (e.g. "page 247 / 412"),
  percentage secondary (e.g. "60%"). Universal percent alone is too lossy.
- Update affordance: **inline stepper directly on the item card**. Modal was
  rejected for being too heavy for the single most common interaction in the app.

## UI decisions (locked)
- Widget shape: **horizontal progress bar** with numeric label on the right.
  Tested cleanly across all card layouts (grid + list).
- Completion marker: **green checkmark + dimmed cover** on completed items.
  No separate "completed" tab — the user wants to see their history mingled in.

## Architecture decisions (locked)
- Data model: **single polymorphic `ProgressRecord` table** with `media_type`
  + `details JSONB` for type-specific fields (page, episode, hours, etc.).
  One-table-per-media-type was rejected for the migration burden and the
  inability to express "all my in-progress items" without a UNION query.
- Frontend pattern: **MVVM** (Mission Control Task-12 enforcement).
  - `progress.model.ts` — types + pure data shape
  - `progress.view.tsx` — read-only presentational component
  - `progress.viewmodel.ts` — state + actions + side-effect orchestration

## Build status
- ✅ `progress.model.ts` (data model + types)
- ✅ `progress.view.tsx` (read-only progress widget)
- ✅ Server sync endpoint (`POST /api/progress`)
- 🔄 `progress.viewmodel.ts` (state + actions) — in progress
- ⏳ Episode-level tracking for TV
- ⏳ Stagnation notification (30-day inactivity)
- ⏳ Multi-device conflict resolution

## Edge cases
- Two devices push conflicting updates within the same second — server takes
  the higher numeric progress (you don't *un-read*), records a small audit row.
- A game's Steam hours decrease (rare but happens with refunds) — we surface
  the discrepancy as a confirmation prompt rather than silently overwriting.
- TV show season finale not yet aired — episode picker caps at the latest aired
  episode known to TMDB.

## Success metrics
- Median time between cards-viewed and first-update under 3 seconds.
- < 0.5% lost updates across devices.
- 30-day stagnation prompt → 25% of users either resume or explicitly pause
  within a week (i.e. the prompt isn't pure noise).
