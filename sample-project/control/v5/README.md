# sample-project / control / v5

Seeded v5 control surface used as the test bed for the v5 dashboard, decision UI,
and end-to-end flow. Four features in different pipeline states:

- `features/team-collab` — **Needs Your Input** (architecture decision pending)
- `features/user-onboarding` — **Ready** (all phases complete)
- `features/notifications` — **In Progress** (build underway, 3/7 tasks done)
- `features/dark-mode` — **Complete** (shipped)

## Diagram assets

The interactive `ux-flow.html` and `architecture-diagram.html` files reference shared
CSS/JS via relative paths. Rather than depending on `control/layout/diagrams/_shared/`
from the kit repo (which won't exist in a real user project), the shared files were
**copied** into `_diagram-assets/` here. Each diagram references them as
`../../_diagram-assets/diagram.css` so the files open standalone in a browser.

If you change the kit-level shared files in `control/layout/diagrams/_shared/`, re-copy
them here (this directory is a snapshot, not a symlink).
