# Cross-Media Search — Spec

## Overview
One search box that returns hits from the user's library **and** from external
catalogs (TMDB for movies/TV, IGDB for games, Open Library for books, Comic
Vine for comics). Results are grouped by media type. External results carry a
quick-add affordance so adding a new item to the backlog takes one click after
typing a title.

## Goals
- Single global search bar reachable from every page.
- p95 server-side query latency under 1 second for the typical 4-source fan-out.
- Quick-add: from "I typed a title" to "it's in my backlog" should take exactly
  one click after the result appears.
- Graceful degradation: if one external source times out, results from the
  other three still render — the slow one shows a "still loading" indicator
  and merges in when it lands.

## Non-goals
- Voice / fuzzy phonetic search ("Hairy Potter" → Harry Potter). Maybe later.
- Search inside book contents / movie transcripts.
- Saved searches / search history.

## User stories
1. As a user, I click the global search bar from anywhere, type "Dune", and
   see grouped results: items in my library, books from Open Library, movies
   from TMDB, games from IGDB.
2. As a user, I click the persistent "Add to backlog" button on a TMDB result
   and the item appears in my library immediately, with cover art pulled in
   the background.
3. As a user with a slow connection, the library + Open Library results render
   first while TMDB/IGDB show a discreet "searching..." indicator.
4. As a user mobile-web, the search bar collapses into an icon I tap to
   expand. Results render in a single scrollable feed.

## UX decisions (locked)
- Default search scope: **library + external catalogs together**. Separating
  them by default made users do twice the work for the most common case.
- Result grouping: **tabbed sections per media type**. Books | Movies | TV |
  Games | Comics. A "library" pill at the top of each tab surfaces in-library
  matches without burying them.

## UI decisions (locked)
- Search entry: **persistent global search bar in the top nav**. Mobile
  collapses to an icon.
- Quick-add: **persistent '+' button visible on every external result card**.
  Hover-reveal was rejected for mobile reasons; modal-then-add adds a click.

## Architecture decisions (locked)
- Fan-out strategy: **parallel fan-out from the server** with 800ms per-source
  timeout. The client makes one request; the server multiplexes outbound and
  streams partial results as they arrive (SSE).
- Cache policy: **Redis with 24h TTL** keyed on `(source, normalized-query)`.
  Normalization is lowercase + collapsed whitespace + stripped punctuation.

## Edge cases
- All four external sources time out → return library-only results with a
  "external catalogs unavailable" banner.
- Query is too short (< 2 chars) → don't fan out; show recent library items
  matching the prefix.
- Comic Vine API key expires → that tab shows an error chip; other tabs
  unaffected. Ops gets paged.
- Duplicate hits (same item from library + external) → collapse, library
  version wins.

## Success metrics
- 60% of search sessions result in either opening an existing item or
  adding a new one to the backlog.
- p95 fan-out latency under 1 second.
- < 0.5% cases where all four external sources timed out.

## Shipped notes
- Released 2026-05-22 to all users.
- Initial week: median 14 searches per active user; quick-add used in 38% of
  sessions. Both above target.
- One known issue: IGDB occasionally returns expansion content as a top hit
  over the base game (e.g. "Witcher 3 Hearts of Stone" outranks "Witcher 3").
  Tracking as a follow-up, not blocking release.
