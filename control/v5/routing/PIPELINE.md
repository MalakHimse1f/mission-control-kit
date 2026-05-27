# v5 Pipeline

Stages, in order, for a regular feature:

| Stage | Produces | Phase gate |
|-------|----------|------------|
| brainstorm | `braindump.md`, optional research → `ux-flow.html` | — |
| ux | UX decisions in `decisions.json` (phase `ux`) | must complete before `ui` |
| ui | UI decisions + `layout/wireframes/*.html` (phase `ui`) | must complete before `architecture` |
| architecture | architecture decisions (phase `architecture`) | must complete before `build` |
| build | code against `phases/phase-N.md`, MVVM-enforced | gated by `canAdvance` |
| validate | tests + e2e gate per `BUILD-GATES.md` | advances phase or marks complete |

Tech-stack features (`status.json.featureType === "tech-stack"`) skip `ux`/`ui`
and start at `architecture`.

The orchestrator never stops between stages; it reads disk, resolves a route
(`lib/v5/mc-router.mjs`), dispatches a narrow subagent, then advances via
`lib/v5/decision-gate.mjs`. There is no static dashboard to regenerate — surface
state with `openDashboard(...)` from `lib/v5/auto-launch.mjs`.
