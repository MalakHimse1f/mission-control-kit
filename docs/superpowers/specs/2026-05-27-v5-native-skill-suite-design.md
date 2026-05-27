# Make the entire `/mc` skill suite v5-native — Design

> Status: approved-for-planning. Date: 2026-05-27.
> Next step: implementation plan via the writing-plans skill.

## 1. Problem

A project running Mission Control Kit **v5** cannot use the `/mc-*` skills:
`/mc-init` (and the rest) are shaped for v4. The audit found the failure has
**two independent layers**.

### Layer 1 — Distribution: v5 skills never reach Claude projects

`claude-skills/` is the tree synced into a Claude Code project's
`.claude/skills/` (`lib/mc-upgrade.mjs` → `syncDirectory({ srcDir:
kitRoot/claude-skills, destDir: project/.claude/skills })`). It is **generated**
by `scripts/build-claude-skills.ps1` from:

- `commands/mc*.md` — but only files that match `^---\n(.*?)\n---\n` (require
  YAML frontmatter), and
- four hardcoded skills copied from `skills/` (`mission-control`,
  `session-handoff`, `spec-portfolio-review`, `mc-layout`).

Consequences:

- `commands/mc-v5.md` and `commands/mc-v5-resume.md` have **no frontmatter**, so
  the build regex skips them silently.
- The rich v5 skill bodies in `skills/mc-v5*/SKILL.md` are **never read** by the
  build at all.
- Net: a Claude project receives the full v4 suite (`/mc-init`, `/mc-feature`,
  `/mc`, …) and **zero v5 skills**. "Using v5" still only exposes v4 `/mc`
  skills — exactly the reported symptom.

### Layer 2 — Skill content is v4-shaped

Of the ~26 skills/commands audited, the large majority (~20) are v4-shaped;
only the **5** `mc-v5*` skills are v5-shaped (and they live **only** in
`skills/`, never reaching `claude-skills/`); `session-handoff` is
version-agnostic; and `mc-setup-skills` is v4-shaped but its vendor bundles are
reused by v5. The v4 skills:

- read/write v4 disk: `state.json` with `techStackStatus` / `pipelineStage` /
  `buildOrder` / `phase`, `HANDOFF.md`, `features/{slug}/` (no `control/v5/`
  prefix);
- depend on v4 orchestration docs: `ROUTER.md`, `ORCHESTRATOR.md`,
  `PIPELINE.md`, `WORKSTREAMS.md`, `AGENT-DATA-RULES.md`, `JOURNAL-RULES.md`,
  `ADD-FEATURE-PIPELINE.md`, `SKILL-DEPENDENCIES.md`, `CONTEXT-PACKETS.md`
  (all under `control/`);
- "regenerate the dashboard" as a static `dashboard.html` artifact;
- use `docs/superpowers/control/scripts/detect-stack.mjs` and similar paths.

Note: even the `mc-v5*` "v5" skills carry v4 residue (e.g. `mc-v5-build`
references `docs/superpowers/control/AGENT-DATA-RULES.md`,
`IMPLEMENTATION_RULES.md`, `HANDOFF.md`, `state.json.activeWorkstream`,
"regenerate dashboard", and "MUST invoke `mission-control`"). The fold-in must
scrub these.

### The v5 gap

v5 has **no way to create a feature or establish tech stack**. `lib/v5/cli/`
contains only `build-decision.mjs`; `migrations/5.0.0-v5-refactor.mjs` seeds an
empty `state.json` stub. The hub (`mc-v5`) only *discovers* existing features.
So a fresh v5 project has no user-facing path to its first feature — this is the
v5 shape of the `/mc-init` problem.

## 2. Goal & principles

- **Keep every `/mc` skill** — the full command surface stays; users keep the
  commands they know.
- **Rewrite each skill's internals to v5**: v5 disk (`control/v5/`), v5 routing
  (`resolveRoute` via `lib/v5/mc-router.mjs`), v5 gates
  (`lib/v5/decision-gate.mjs`), the live dashboard (`lib/v5/auto-launch.mjs`),
  and the v5 routing docs under `control/v5/routing/`.
- **Zero duplication**: the `mc-v5*` prototypes are folded into the canonical
  names and deleted. No `-v5` suffix survives anywhere.
- **Fix distribution** so the rewritten skills actually reach Claude projects,
  guarded by a regression test.

## 3. v5 facts the rewrites build on (reference)

- **Disk**: `control/v5/state.json` = `{ version, activeFeature, features: [{
  slug, stage, currentPhase }] }`. Per-feature `control/v5/features/{slug}/`:
  `status.json` (`slug`, `stage`, `currentPhase`, `featureType?`,
  `description`, `lastUpdatedAt`, `tasks?`), `decisions.json` (schema in
  `lib/v5/decisions-schema.mjs`), `spec.md`, `ux-flow.html`, `decisions/{id}.html`,
  `phases/phase-N.md`, `journal/NNN-*.md`, `explore/*`, `layout/wireframes/*`.
- **Routing**: `resolveRoute({ taskType, stage, slug, controlRoot })` →
  `{ docs[], usageNote, deferred }`. `controlRoot` is **the project root**
  (directory containing `control/v5/`).
- **Gates**: `currentPhase`, `nextPhase`, `canAdvance`, `isTechStackFeature`
  from `lib/v5/decision-gate.mjs`. Phase order `ux → ui → architecture → build`;
  tech-stack features collapse to `architecture → build`.
- **Decisions**: `readDecisions`/`writeDecisions`/`markPhaseComplete`/
  `deferQuestion` (`lib/v5/decisions.mjs`); fragments via
  `node lib/v5/cli/build-decision.mjs <slug> <id>`; never hand-author card HTML.
- **Dashboard**: `openDashboard({ slug, anchor, controlRoot })`
  (`lib/v5/auto-launch.mjs`) — live server, no static regeneration.
- **Pickup**: `buildPickupPrompt({ slug, stage, taskType? })`
  (`lib/v5/build-pickup-prompt.mjs`) — the v5 resume mechanism.

## 4. The canonical skill set (after fold-in)

No `-v5` suffix survives. `mc-v5*` prototypes are deleted as their logic merges.

| Canonical skill | User-facing? | v5 role | Absorbs / action |
|---|---|---|---|
| `mc` | yes | Orchestrator hub: read disk → resolve route → dispatch → gate → next | absorbs `mc-v5`; delete `mc-v5` |
| `mc-start` | yes | New project: scaffold `control/v5/`, seed tech-stack + first features | rewrite |
| `mc-init` | yes | Establish tech-stack as a `featureType:"tech-stack"` feature; detect stack | rewrite (primary pain point) |
| `mc-braindump` | yes | Brainstorm → offer research → `ux-flow.html` → decisions → dashboard | absorbs `mc-v5-brainstorm`; delete it |
| `mc-feature` | yes | Scaffold `control/v5/features/{slug}/`, then run the v5 pipeline via hub | rewrite |
| `mc-explore` | subagent | Exploration → `control/v5/features/{slug}/explore/` + journal | rewrite paths |
| `mc-prd` | subagent | `spec.md` via `prd-generator` → `control/v5/features/{slug}/spec.md` | rewrite paths |
| `mc-layout` | yes | UI phase: wireframes under `…/layout/wireframes/`, `ui-implementation` route | rewrite |
| `mc-mock` | subagent | Produce wireframe HTML per layout target | rewrite paths |
| `mc-plan` | yes | Single-workstream phase plan → `…/phases/`, populate `status.json.tasks[]` | rewrite |
| `mc-platform-plan` | subagent | All-platform phase plans in one pass (naming consistency) | rewrite |
| `mc-build` | yes | Subagent build loop + MVVM enforcement + fragment preflight | absorbs `mc-v5-build`; delete it |
| `mc-validate` | yes | Phase gates via `canAdvance`/`BUILD-GATES`, e2e, live dashboard | rewrite |
| `mc-portfolio` | yes | Cross-feature review over `control/v5/features/*`; build order in `state.json` | rewrite |
| `spec-portfolio-review` | subagent | The portfolio analysis the above dispatches | rewrite paths |
| `mc-refine` | yes | Resume/refine a feature's decisions/spec in `control/v5` | rewrite |
| `mc-handoff` | yes | Emit `buildPickupPrompt` pickup + brief summary | rewrite/simplify |
| `session-handoff` | subagent | Chat-only handoff synthesis (already mostly agnostic) | light touch |
| `mc-upgrade` | yes | Script-driven kit upgrade; preserve `control/v5/` data | light touch |
| `mc-setup-skills` | subagent | Install vendor bundles (used by v5 too); scrub v4 journal path | light touch |
| `mc-decide` | subagent | Canonical decision-encoding flow | rename from `mc-v5-decide` |
| `mc-review` | subagent | Auto-launch dashboard on artifact events | rename from `mc-v5-review` |
| `mission-control` | (internal) | v4 hub doc-loader — **superseded by `mc`**; delete | delete (its role is the `mc` hub) |

### Per-skill rewrite notes (v4 → v5 substitutions)

Applied uniformly across all rewrites:

- `state.json` (root) → `control/v5/state.json`; fields `techStackStatus` /
  `pipelineStage` / `buildOrder` / `phase` → `stage` / `currentPhase` /
  `featureType` on `status.json`, plus `activeFeature` / `features[]` on
  `state.json`.
- `features/{slug}/…` → `control/v5/features/{slug}/…`.
- Reading `ROUTER.md` / `ORCHESTRATOR.md` / `PIPELINE.md` / `WORKSTREAMS.md` /
  `AGENT-DATA-RULES.md` / `CONTEXT-PACKETS.md` → use `resolveRoute` and the docs
  in `control/v5/routing/`.
- "regenerate dashboard" / `dashboard.html` → `openDashboard({ slug, anchor,
  controlRoot })`.
- `HANDOFF.md` → `buildPickupPrompt(...)` for resume; chat summary for handoff.
- Decision capture anywhere → dispatch `mc-decide` (never write `decisions.json`
  or fragment HTML ad hoc).
- Phase transitions → `canAdvance` / `nextPhase` before advancing.
- "MUST invoke `mission-control`" → removed (the `mc` hub is the orchestrator).

## 5. New plumbing (fills the v5 gap)

- **`lib/v5/feature-scaffold.mjs`** — `scaffoldFeature({ slug, description,
  featureType, controlRoot })`: create `control/v5/features/{slug}/` with a
  default `status.json` and a schema-valid empty `decisions.json`
  (via the `decisions-schema.mjs` default shape), idempotent (never clobbers an
  existing feature). Registers the feature in `state.json`.
- **`lib/v5/state.mjs`** — atomic (tmp + rename) read/modify/write of
  `control/v5/state.json`: `upsertFeature(...)`, `setActiveFeature(...)`,
  mirroring the `decisions.mjs` pattern and the project-root `controlRoot`
  contract.
- **`lib/v5/cli/new-feature.mjs`** — CLI wrapper around `scaffoldFeature`,
  mirroring `cli/build-decision.mjs` (resolve `controlRoot`, print path, exit
  non-zero on failure). Used by `mc-feature`, `mc-init` (with
  `featureType:"tech-stack"`), and `mc-start`.
- **Stack detection** — port the read-only parts of v4 `detect-stack.mjs` into a
  v5-aware helper (or relocate it under `lib/v5/`) so `mc-init` can pre-fill the
  tech-stack feature; no v4 `docs/superpowers/control/` path.

All new helpers get unit tests in `tests/` alongside the existing `v5-*` suite.

## 6. Distribution fix

- **`skills/` is the single source of truth.** `claude-skills/` becomes a
  **straight copy** — after the rewrite, every `SKILL.md` already has correct
  frontmatter, so no transform is needed.
- **Replace `scripts/build-claude-skills.ps1` with `scripts/build-claude-skills.mjs`**
  (Node, cross-platform): copy every `skills/<name>/` into `claude-skills/<name>/`
  verbatim (preserving sibling files like `parallel-execution.md`). Keep a thin
  `.ps1`/`.sh` wrapper for convenience. Wire it into install/upgrade.
- **`commands/`** — give every `commands/mc*.md` proper YAML frontmatter; after
  rename they map 1:1 to skills. (`mc-v5.md`/`mc-v5-resume.md` are renamed to
  `mc.md` hub usage / `mc-resume.md` or folded as appropriate.)
- **Sync regression test** (`tests/skills-sync.test.mjs`): assert
  `claude-skills/` contains every `skills/` directory with byte-identical
  `SKILL.md`. This makes the Layer-1 bug impossible to reintroduce.

## 7. v4 document deletion

The v4-only orchestration docs are **deleted** (decision: nobody uses v4). Before
deleting, port the concepts the v5 skills still need into `control/v5/routing/`:

- **`control/v5/routing/PIPELINE.md`** — the v5 stage order and what each stage
  produces (replaces `PIPELINE.md` / `ADD-FEATURE-PIPELINE.md`).
- **`control/v5/routing/DATA-RULES.md`** — add-never-erase + `state.json` /
  `status.json` merge rules (replaces `AGENT-DATA-RULES.md`).
- **`control/v5/routing/JOURNAL-RULES.md`** — v5 journal format under
  `control/v5/features/{slug}/journal/` (replaces `JOURNAL-RULES.md`).

Then delete the v4 docs under `control/`: `ROUTER.md`, `ORCHESTRATOR.md`,
`PIPELINE.md`, `WORKSTREAMS.md`, `AGENT-DATA-RULES.md`, `JOURNAL-RULES.md`,
`ADD-FEATURE-PIPELINE.md`, `SKILL-DEPENDENCIES.md`, `CONTEXT-PACKETS.md`,
`SESSION-INTENT.md`, `RESEARCH-LAYOUT.md`, `ORCHESTRATOR-CONTROLS.md`,
`WORKFLOW-CONTROLS.md`, `PROJECT-START-PIPELINE.md`, `SPEC-PORTFOLIO-REVIEW.md`,
`tech-stack/LAYOUT-TARGETS.md`, and the v4 static dashboard
(`control/dashboard.html`, `control/scripts/dashboard-guide.mjs`, and the v4
`control/scripts/dashboard-server.mjs` / generator) — final list confirmed
during planning by grepping for remaining readers.

## 8. Documentation surfaces

- **Dashboard "How to use" panel** — rewrite `SLASH_COMMANDS`, `BUNDLED_SKILLS`,
  and `WORKFLOWS` in `control/scripts/v5/render-dashboard.mjs` (~lines 262–343)
  to the unified v5 command set; fix the empty-state copy
  (`start a feature with /mc-v5` → `/mc`). Keep entries one-line per the panel's
  existing style.
- **User-Guide.html** (repo root) — update the command table (lines ~95–100);
  repoint the dashboard link from the v4 static `control/dashboard.html` to the
  live v5 dashboard (launch instruction / `node …/control/scripts/v5/dashboard-server.mjs .`).
- **`install.ps1` `Publish-UserGuide`** — it currently rewrites `href="control/"`
  → `href="docs/superpowers/control/"`, i.e. the old v4 wrapping. Update it to the
  v5-native layout (no `docs/superpowers/` wrapping), consistent with the
  in-progress "drop docs/superpowers/ wrapping" change. Confirm the install/sh
  counterparts during planning.

## 9. Testing & verification

- `tests/skills-sync.test.mjs` (§6).
- `tests/skills-no-v4-markers.test.mjs` — fail if any shipped skill body (under
  `skills/`) contains forbidden v4 strings: `docs/superpowers/control`,
  `techStackStatus`, `pipelineStage`, `buildOrder`, `HANDOFF.md`,
  `regenerate dashboard`, `ROUTER.md`, `ORCHESTRATOR.md`, `PIPELINE.md`,
  `WORKSTREAMS.md`, `AGENT-DATA-RULES.md`, `mission-control` (as a skill to
  invoke). This mechanically prevents the audit from regressing.
- Unit tests for `feature-scaffold` / `state` / `new-feature` CLI.
- Update existing `tests/v5-*` and any tests referencing renamed skills.
- Full `node --test` run; manual dashboard smoke (launch server, open a feature,
  confirm "How to use" shows the v5 commands).

## 10. Build order

1. Plumbing: `feature-scaffold.mjs`, `state.mjs`, `cli/new-feature.mjs`, stack
   helper — with unit tests.
2. Port v5 routing docs: `PIPELINE.md`, `DATA-RULES.md`, `JOURNAL-RULES.md`.
3. Rewrite skills family-by-family, deleting each `mc-v5*` as it is folded:
   hub (`mc`) → `mc-start` / `mc-init` / `mc-feature` → `mc-braindump` →
   `mc-explore` / `mc-prd` → `mc-layout` / `mc-mock` → `mc-plan` /
   `mc-platform-plan` → `mc-build` → `mc-validate` → `mc-portfolio` /
   `spec-portfolio-review` / `mc-refine` / `mc-handoff` / `session-handoff` →
   `mc-setup-skills` / `mc-upgrade`; rename `mc-v5-decide`→`mc-decide`,
   `mc-v5-review`→`mc-review`; delete `mission-control`.
4. Distribution: `build-claude-skills.mjs`, command frontmatter, regenerate
   `claude-skills/`, sync + no-v4-markers tests.
5. Delete v4 docs (§7) after confirming no remaining readers.
6. Doc surfaces (§8).
7. Full verification (§9).

## 11. Out of scope

- A v4 → v5 data migration path (the two pipelines have different state; nobody
  is on v4).
- New dashboard features beyond the "How to use" content refresh.
- Changes to the v5 engine internals (`lib/v5/mc-router.mjs`,
  `decision-gate.mjs`, the visual builder) beyond the additive scaffold/state
  helpers.

## 12. Resolved decisions

- **v4 strategy**: nobody uses v4 — make `/mc-*` v5-native; no version-detection
  branching.
- **v4 docs**: delete (after porting needed concepts to `control/v5/routing/`).
- **decide/review naming**: rename to `mc-decide` / `mc-review` (internal).
- **skill trees**: keep `skills/` as source; generate `claude-skills/` as a
  straight copy.
- **deliverable**: audit + this design doc + plan, then implement.
