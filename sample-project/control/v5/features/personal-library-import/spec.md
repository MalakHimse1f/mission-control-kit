# Personal Library Import — Spec

## Overview
Let a new MediaFlow user populate their library in minutes by bulk-importing from
sources they already maintain — Goodreads, Letterboxd, Steam, Open Library, or a
manual CSV. Without this feature the first-run experience requires typing in
hundreds of items by hand, which is the single biggest reason testers churn before
ever seeing the backlog dashboard.

## Goals
- Onboard a user with 200+ existing items in under 5 minutes start-to-finish.
- Support five sources at launch: Goodreads (CSV), Letterboxd (CSV), Steam
  (OAuth via Steam Web API), Open Library (search-based), manual CSV (any media).
- Surface duplicates inline before they get written — never silently overwrite.
- Resumable: if the user closes the tab mid-import, they can return and pick up
  from the conflict-review step.

## Non-goals
- Two-way sync. This is one-shot import only; we do not push changes back.
- Realtime ingestion (e.g. "watch my Goodreads forever"). Future feature.
- Scraping sites without official export support (e.g. IMDb watchlist HTML).

## User stories
1. As a new user, I land on `/import` from the onboarding card and see a list of
   sources I can pull from with a one-line description of what each will import.
2. As a Goodreads user, I export my CSV, drop it in, and within seconds I see a
   preview of what's about to be added (with cover art where we can resolve it).
3. As a Steam user, I authorize via OAuth and my owned-games list appears in the
   review step. Hours-played and last-played carry over.
4. As a returning user re-importing the same source, I am shown each duplicate
   with keep/replace/skip controls before anything is written.
5. As any user, I watch a progress bar while the import runs and I can navigate
   away — when I come back the same job is still visible and resumable.

## UX decisions (locked)
- Source picker pattern: **stepped wizard** — Step 1 source pick → Step 2
  authenticate or upload → Step 3 conflict review → Step 4 confirm. The wizard
  pattern beat unified-dropzone because per-source steps differ too much (OAuth
  vs file upload), and beat the flat list because users want to know what
  happens *next* before they pick.
- Conflict handling: **inline review** before commit. Surface each duplicate
  with three actions: keep existing, replace with imported, skip. Bulk
  "apply to all remaining" is available.

## UI decisions (locked)
- Surface placement: **dedicated `/import` page** linked from the empty-state
  library, the onboarding checklist, and Settings → Import. Modals would feel
  too cramped for a multi-step flow with previews.
- Progress display: **inline progress bar** with running item count and ETA,
  embedded in the wizard's step 4. No full-screen blocking.

## Architecture decisions
- **Auth transport (locked):** OAuth redirect with per-provider client
  credentials for sources that support it (Steam). Other sources require the
  user to upload an export file.
- **Connector pattern (pending):** how do we structure per-source importers?
  - `plugin-modules` — each source is its own JS module behind a common
    `SourceConnector` interface. New sources = drop in a new file.
  - `monolithic-service` — a single `ImportService` with a switch-case per
    source. Simplest code, hardest to extend.
  - `serverless-functions` — each source is its own Cloud Function. Strong
    isolation and per-source scaling, but cold-start latency and infra cost.
  - Blocked on a load estimate for Goodreads CSVs (most users have <5k items;
    a few power users have 30k+).

## Edge cases
- Goodreads CSV missing an ISBN — fall back to title+author lookup against
  Open Library; if still unresolved, import with no cover art and flag.
- Steam OAuth expires mid-import — pause job, surface re-auth prompt, resume.
- User closes the tab after upload but before confirming — store the staged
  preview server-side for 24h; show a "resume import" banner on return.
- Duplicate within the imported file (same book twice in one CSV) — collapse
  silently, log a warning in the post-import summary.

## Open questions
- Should we rate-limit per-source independently or share a global token bucket
  for outbound API calls? (Deferred from UX phase.)
- Do we support partial re-import — "only import items added since last run"?
  Probably yes, but design TBD.

## Success metrics
- 80% of new users who start an import complete it within the same session.
- p95 wall-clock time for a 1,000-item Goodreads CSV import under 60 seconds.
- < 1% duplicate-write rate (i.e. inline review actually catches them).
