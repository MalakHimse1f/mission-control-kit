# Personal Library Import — Braindump

Stuff I scribbled before this turned into a spec.

- The single biggest first-run problem: empty library. Nobody manually types in 300 books.
- People already have lists. Goodreads. Letterboxd. Steam. Their own spreadsheet.
- Pull from those sources and the app suddenly has a reason to exist.
- Goodreads: they let you export a CSV. Easy mode.
- Letterboxd: also CSV exports. Annual + lifetime.
- Steam: there's a Web API, OAuth-ish. Owned games list is the prize.
- Open Library: more like an enrichment source than a "library" — useful for ISBN lookup, cover art, normalizing titles.
- Manual CSV: catch-all for comics, TV shows, anything we don't have a connector for.
- IMDb would be killer but they don't have a clean export. Skip for v1.
- The flow needs to be a wizard, not a "dump everything in one box." Each source has its own ask (file upload vs OAuth) and that's hard to make uniform.
- Wait — actually, could it be a unified dropzone that just sniffs the file? Goodreads CSV looks different from Letterboxd CSV. Maybe. But Steam isn't a file at all. So no, wizard wins.
- Dupes are the scary part. If a user runs import twice, do they end up with 600 of the same book? No.
- Inline review before commit. Show each dupe, let them pick. Bulk "apply to all" so we don't make them click 200 times.
- Some user is going to have 30,000 items. Don't block the UI on that.
- Progress bar with ETA. Backgroundable — they can navigate away.
- Resume on return. Means we have to stage the import server-side, not in memory.
- Connector pattern question is real. Three options on the table: plugin modules, one big switch, or one-function-per-source. Plugin modules feels right for "we'll add Spotify next year." But maybe over-engineering for 5 sources.
- Cold storage on serverless? Per-import cost is tiny but might add up at scale. Probably premature optimization.
- Rate limiting: each source has its own quota. Steam is generous. Open Library is pretty open. Goodreads is just a file — no quota. Probably solve per-source.
- OAuth callback URLs: need a registered redirect per environment. Annoying ops detail.
- Errors mid-import: should NOT discard everything. Save what we got. Show what failed.
- Cover art lookup hits Open Library. If it 429s, we still import the book — just no cover.
- One day: "watch my Goodreads forever." Not now. Hard problem, separate spec.
- Need to write tests against a real Goodreads export. I have my own. ~1,400 items.
- Letterboxd export has a "watched" flag + rating. That maps cleanly to "in library + rating."
- Steam playtime maps to "progress hours." For now ignore achievements; revisit when progress-tracker ships.
- Onboarding entry point: empty-state CTA on the library page, plus a card in the welcome checklist.
