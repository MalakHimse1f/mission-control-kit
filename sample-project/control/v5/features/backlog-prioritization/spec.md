# Backlog Prioritization — Spec

## Overview
A "Next Up" surface on the home dashboard that ranks the user's backlog so they
can answer "what should I play / watch / read next?" without scrolling through
hundreds of unstarted items. The ranking is a hybrid: user-pinned items always
appear first, followed by algorithmic suggestions based on recency, completion
likelihood, and series continuity.

## Goals
- Surface a useful "next up" recommendation within 2 seconds of dashboard load.
- Respect explicit user intent: pinned items always rank above algorithmic ones.
- Honor series continuity: if the user is mid-way through book 3 of a series,
  book 4 should rank highly.
- Make the widget dismissible per item, with the dismissal feeding the model.

## Non-goals
- Cross-user / social recommendations (not a social product).
- Genre-based "for you" recommendations against external catalogs — that's
  cross-media-search's territory.
- Real-time recompute on every library change (nightly batch is fine).

## User stories
1. As a user with a 200-item backlog, I open the dashboard and see 6 ranked
   suggestions for what to engage with next.
2. As a user who pinned three items, I see all three pinned items first,
   then up to three algorithmic suggestions below.
3. As a user mid-way through "The Wheel of Time", I see book 4 ranked above
   unrelated unstarted books.
4. As a user, when I dismiss a suggestion I never see it on the dashboard again
   until I revisit it manually.

## UX decisions (locked)
- Ranking model: **hybrid** — user pins override algorithmic ranking; remaining
  slots filled by the scoring engine.
- Surface location: **dashboard widget** at the top of the home page. A
  dedicated `/next` page was rejected for being one click too many.

## UI decisions (locked)
- Card style: **cover art + title + progress bar + dismiss button** in a
  responsive grid (1 column mobile, 3 columns desktop).
- Empty state: **friendly empty-state with a 'Browse library' CTA**. Hiding the
  widget entirely was tempting but it hurts discoverability of the feature.

## Architecture decisions (locked)
- Scoring locus: **server-side, nightly cron**. Results cached per-user; client
  reads pre-computed scores. Per-request scoring was rejected because the
  signals (recency, completion likelihood) don't change minute-to-minute.
- Signal store: **materialized view** rebuilt nightly. Joining a separate
  signals table on every dashboard read added latency we don't need.

## Scoring formula (v1, locked)
```
score = w1 * recency_decay         // last-touched within N days → higher
      + w2 * series_continuity     // "next item in active series" → boost
      + w3 * estimated_completability  // short books > long; recent media boosted
      + w4 * user_signal           // explicit pin = floor of +1000
      - dismissal_penalty
```
Weights tunable per-user later (out of scope for v1).

## Edge cases
- Empty backlog → empty-state CTA points to import or browse.
- New user (no signals yet) → fall back to "most recently added" until the
  nightly job runs once.
- User dismisses every suggestion → after 7 days of dismissals show a "we'll
  stop suggesting things" message and pause the widget for 30 days.

## Success metrics
- 40% of dashboard sessions result in clicking a "Next Up" item.
- < 5% dismissal-then-re-engagement rate (i.e. the model isn't suggesting junk
  that users immediately remove).
- Nightly job completes for the full user base in under 10 minutes.

## Build readiness
All three decision phases are complete. Ready for dispatch into the build
stage; no open architectural questions. Estimated 5-7 tasks.
