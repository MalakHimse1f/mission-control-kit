# sample-project / control / v5

Seeded v5 control surface used as the test bed for the v5 dashboard, decision UI,
and end-to-end flow.

This mock represents **MediaFlow** — a personal media ownership and backlog
tracker for one user managing books, comic books, movies, TV shows, and video
games (web app, mobile-responsive, no social). Four features sit in different
pipeline states so the dashboard exercises every bucket:

- `features/personal-library-import` — **Needs Your Input** (architecture
  decision pending: source-connector pattern; one deferred UX question)
- `features/backlog-prioritization` — **Ready** (all phases complete; awaiting
  build dispatch)
- `features/progress-tracker` — **In Progress** (build underway, 3/7 tasks
  done; MVVM-styled per Task-12)
- `features/cross-media-search` — **Complete** (shipped 2026-05-22)

## Diagram assets

The interactive `ux-flow.html` and `architecture-diagram.html` files reference shared
CSS/JS via relative paths. Rather than depending on `control/layout/diagrams/_shared/`
from the kit repo (which won't exist in a real user project), the shared files were
**copied** into `_diagram-assets/` here. Each diagram references them as
`../../_diagram-assets/diagram.css` so the files open standalone in a browser.

If you change the kit-level shared files in `control/layout/diagrams/_shared/`, re-copy
them here (this directory is a snapshot, not a symlink).
