# Mission Control Kit v5 — Execution Plan

This plan turns `docs/REFACTOR-REQUIREMENTS.md` plus `docs/v5-diagrams/*.html` into discrete, dispatchable tasks. v4 stays in place; v5 is built alongside as new files/skills/commands. Backward compatibility is NOT a goal — v5 is a parallel pipeline that supersedes v4 once it's stable.

**Scope conventions:**
- New v5 files live under explicit v5 paths where they overlap with v4 (e.g., `control/scripts/dashboard-v5/`, `lib/v5/`, `skills/mc-v5-*`, `commands/mc-v5-*.md`).
- Existing v4 files stay untouched unless a task explicitly says otherwise.
- All v5 state writes go to NEW state files; do not corrupt v4 state.

**Layered task order:** primitives → persistence → mock data → dashboard → integration → orchestrator behavior → polish.

---

## Task 0 — v5 layout scaffolding

**Goal:** Create the empty directory skeleton and stub files described in `docs/v5-diagrams/02-data-storage.html` so later tasks have known landing zones.

**Files to create:**
- `control/v5/.gitkeep` (root of v5 control surface)
- `control/v5/routing/.gitkeep`
- `control/v5/routing/ROUTING-MANIFEST.md` — stub with the route table from §2 of REFACTOR-REQUIREMENTS.md
- `control/v5/routing/UI-REQUIREMENTS.md` — stub
- `control/v5/routing/UX-PATTERNS.md` — stub
- `control/v5/routing/ARCHITECTURE.md` — stub including MVVM rules from §10
- `control/v5/routing/BUILD-GATES.md` — stub
- `control/layout/diagrams/architecture/.gitkeep`
- `control/layout/diagrams/ux-flow/.gitkeep`
- `control/layout/diagrams/ui-options/.gitkeep`
- `lib/v5/.gitkeep`
- `control/scripts/v5/.gitkeep`

**Acceptance:** All paths exist on disk; the four routing markdown files contain section headings matching their concerns even if bodies are placeholder.

---

## Task 1 — Diagram primitives (architecture, ux-flow, ui-options)

**Goal:** Build three reusable HTML/CSS/JS primitives in `control/layout/diagrams/` matching the styles in `docs/v5-diagrams/03-interactive-decisions.html` and `07-feature-presentation.html`.

**Files to create:**
- `control/layout/diagrams/architecture/template.html` — single-file primitive: title, 2-4 option cards each containing an SVG architecture diagram + label + radio behavior. Self-contained CSS, no framework.
- `control/layout/diagrams/architecture/README.md` — how subagents fill it in
- `control/layout/diagrams/ux-flow/template.html` — horizontal step timeline + decision nodes with selectable branches
- `control/layout/diagrams/ux-flow/README.md`
- `control/layout/diagrams/ui-options/template.html` — side-by-side mini-layout cards (dialog/drawer/sheet style comparisons)
- `control/layout/diagrams/ui-options/README.md`
- `control/layout/diagrams/_shared/diagram.css` — shared dark-theme tokens
- `control/layout/diagrams/_shared/diagram-select.js` — client-side selection helper (single-select per group, exposes `getSelections()` and `onSave(callback)`)
- `control/layout/diagrams/_shared/decisions-client.js` — POSTs selections to `/api/v5/decisions/{slug}` on save (browser fetch)

**Acceptance:**
- Open each template.html standalone in browser → renders cleanly, click-to-select works.
- Selections survive interaction with sibling cards (single-select per group).
- decisions-client.js exposes `MCDecisions.save(slug, decisions)` returning a Promise.

---

## Task 2 — `decisions.json` schema and read/write utilities

**Goal:** Define schema (per §3.4 and §9.3 of REFACTOR-REQUIREMENTS), provide Node utilities.

**Files to create:**
- `lib/v5/decisions.mjs` — exports `readDecisions(slug, opts)`, `writeDecisions(slug, payload, opts)`, `markPhaseComplete(slug, phase, opts)`, `getPhaseStatus(slug, opts)`. Takes optional `controlRoot` (defaults to nearest `control/v5/features/{slug}/`).
- `lib/v5/decisions-schema.mjs` — exported JSON schema constant for validation
- `tests/v5-decisions.test.mjs` — node:test coverage: round-trip, phase status transitions, schema rejection of bad payloads, defer-question append.

**Schema (canonical):**
```json
{
  "feature": "user-onboarding",
  "phases": {
    "ux":           { "status": "complete|in-progress|not-started", "decisions": [...], "pending": [...] },
    "ui":           { "status": "...", "decisions": [...], "pending": [...] },
    "architecture": { "status": "...", "decisions": [...], "pending": [...] }
  },
  "deferred": [ { "question": "...", "raisedDuring": "ux", "raisedAt": "..." } ],
  "updatedAt": "ISO-8601"
}
```

Each decision entry: `{ id, category, question, options[], selected, decidedAt }`.

**Acceptance:**
- Tests pass with `node --test tests/v5-decisions.test.mjs`.
- Writing to an unknown slug auto-creates `control/v5/features/{slug}/decisions.json`.
- Invalid payloads throw with descriptive errors.

---

## Task 3 — Dashboard server v5: `/api/v5/decisions/{slug}` endpoint

**Goal:** Add v5 API endpoints to a new dashboard server. Don't touch the v4 `dashboard-server.mjs`.

**Files to create:**
- `control/scripts/v5/dashboard-server.mjs` — new HTTP server, port resolved via `lib/v5/server-port.mjs`. Endpoints:
  - `GET /` → renders v5 dashboard HTML (placeholder body for now; Task 6 will fill it in)
  - `GET /feature/:slug` → renders v5 feature detail (placeholder body)
  - `GET /api/v5/decisions/:slug` → returns saved decisions JSON
  - `POST /api/v5/decisions/:slug` → writes decisions JSON
  - `GET /api/v5/features` → lists v5 features with stage + status
  - Static asset serving for `/diagrams/*` from `control/layout/diagrams/`
- `lib/v5/server-port.mjs` — port resolver writing to `control/.mc/v5-dashboard-server.json`
- `lib/v5/launch-server.mjs` — `ensureRunning()` that checks status JSON, spawns server if needed, returns `{ port, url }`
- `tests/v5-dashboard-server.test.mjs` — integration test: spawn, POST decision, GET decision, shut down

**Acceptance:**
- Server starts cleanly with `node control/scripts/v5/dashboard-server.mjs`.
- POSTing JSON to `/api/v5/decisions/user-onboarding` writes to disk and GET returns same data.
- 400 on schema violation, 404 on unknown route.
- Tests pass.

---

## Task 4 — Mock project: v5 features with seeded decisions

**Goal:** Expand `sample-project/` per §8 of REFACTOR-REQUIREMENTS.

**Files to create/expand:**
- `sample-project/control/v5/features/team-collab/` — full feature in "Needs Your Input" state with architecture decisions partly pending. Include `status.json`, `decisions.json`, `spec.md`, `braindump.md`, a pre-rendered `ux-flow.html` (use ux-flow template from Task 1), an `architecture-diagram.html` from architecture template.
- `sample-project/control/v5/features/user-onboarding/` — "Ready for Development" state. All phases complete in `decisions.json`.
- `sample-project/control/v5/features/notifications/` — "In Progress" state.
- `sample-project/control/v5/features/dark-mode/` — "Complete" state.
- `sample-project/control/v5/state.json` — global v5 state listing all four features

**Acceptance:**
- Pointing the Task-3 server at `sample-project/control/v5/` returns four features via `/api/v5/features`.
- Each feature's `decisions.json` validates against the Task-2 schema.

---

## Task 5 — Dashboard v5 page templates (three sections + filters)

**Goal:** Build the dashboard HTML matching `docs/v5-diagrams/06-dashboard-mockup.html`.

**Files to create:**
- `control/scripts/v5/render-dashboard.mjs` — produces the homepage HTML using data from `lib/v5/dashboard-data.mjs`
- `lib/v5/dashboard-data.mjs` — reads `control/v5/state.json` + each feature's `status.json` + `decisions.json`, computes section assignments (live-agents / up-next / all-items + filter buckets)
- `control/scripts/v5/dashboard.css` — extracted from the mockup
- `control/scripts/v5/dashboard-client.js` — filter-pill interactions, navigation links

**Acceptance:**
- `GET /` from Task-3 server returns matching layout: Live Agents → Up Next → All Items with filter pills (Needs Your Input / Ready / In Progress / Complete).
- Filter pills mutually exclusive, counts visible.
- Item rows link to `/feature/:slug` (full-page navigation, no modals).
- Matches the dark theme of 06-dashboard-mockup.html within ~95% visual fidelity.

---

## Task 6 — Feature detail page (interactive diagrams + tabs + save)

**Goal:** Build the feature detail page matching `docs/v5-diagrams/07-feature-presentation.html`.

**Files to create:**
- `control/scripts/v5/render-feature.mjs` — produces `/feature/:slug` HTML
- `lib/v5/feature-data.mjs` — assembles tabs (UX/UI/Architecture) from `decisions.json`
- Embed the Task-1 diagram templates inline (or via iframe) and wire them to the decisions client

**Acceptance:**
- Three tabs (UX, UI, Architecture) render. Each shows a diagram with current selections highlighted.
- Sticky "Save All Decisions" bar at bottom.
- Save calls `POST /api/v5/decisions/:slug` and toasts confirmation.
- After save, reload preserves selections.
- Back link returns to dashboard.

---

## Task 7 — Auto-launch dashboard skill + helper

**Goal:** Implement §5 of REFACTOR-REQUIREMENTS, matching `docs/v5-diagrams/05-auto-launch.html` state machine.

**Files to create:**
- `lib/v5/auto-launch.mjs` — `openDashboard({ slug, anchor })`: ensures server running (Task-3 helper), determines target URL, runs `open` on macOS or `xdg-open` on Linux, returns the URL.
- `skills/mc-v5-review/SKILL.md` — orchestrator-callable skill: "when a visual artifact is created or user says 'show me', call openDashboard and tell the user the URL."
- `tests/v5-auto-launch.test.mjs` — mocks the spawn and URL open; verifies the right URL is constructed given different triggers.

**Acceptance:**
- Calling `openDashboard({slug: 'user-onboarding', anchor: 'decisions'})` opens `http://127.0.0.1:{port}/feature/user-onboarding#decisions`.
- If server isn't running, it starts and waits for the port before opening.
- Skill markdown documents the four trigger events from diagram 05.

---

## Task 8 — Router v5: routing manifest + task→docs mapping

**Goal:** Implement §2 of REFACTOR-REQUIREMENTS.

**Files to create:**
- `lib/v5/mc-router.mjs` — `resolveRoute({ taskType, stage, slug })` returns `{ docs: [...], packetSummary: '...' }`.
- `control/v5/routing/ROUTING-MANIFEST.md` — body filled in from Task 0 stub: the route table mapping task types to documents.
- `lib/v5/context-packet.mjs` — `buildPacket({ task, route, stage, slug })` produces the focused context packet object shown in diagram 01.
- `tests/v5-router.test.mjs` — covers all six route types from diagram 01.

**Acceptance:**
- `resolveRoute({taskType: 'ui-implementation'})` returns the UI-REQUIREMENTS + primitives + wireframes list.
- Adding a new task type only requires editing the manifest + a small router map.
- Router refuses to load architecture docs when stage is `ux` (§9.4 backtracking prevention) — instead returns a "deferred" hint.

---

## Task 9 — Decision sequencing enforcement

**Goal:** Implement §9 of REFACTOR-REQUIREMENTS, matching diagram 08.

**Files to create:**
- `lib/v5/decision-gate.mjs` — `canAdvance(slug, fromPhase, toPhase)` reads decisions.json, returns `{ allowed, reason }`.
- `lib/v5/defer-question.mjs` — `deferQuestion(slug, question, raisedDuring)` appends to `decisions.json.deferred`.
- `lib/v5/surface-deferred.mjs` — `surfaceDeferred(slug, atPhase)` returns deferred items relevant to the new phase.
- `tests/v5-sequencing.test.mjs` — covers tech-stack bypass, gate refusal, deferred surfacing.

**Acceptance:**
- `canAdvance` returns `{allowed: false}` if any decision in current phase is pending.
- Tech-stack slugs (detected via status.json field) bypass UX/UI gates.
- Deferred questions surface in the right phase.

---

## Task 10 — Pickup prompt compression + v5 orchestrator skill

**Goal:** Implement §1 of REFACTOR-REQUIREMENTS — short pickup prompts that send the orchestrator to read its own context.

**Files to create:**
- `skills/mc-v5/SKILL.md` — the v5 orchestrator hub. Replaces `mc` for v5 workflows. Tells the orchestrator to read its current stage from `control/v5/features/{slug}/status.json`, resolve a route via the router, load only routed docs.
- `commands/mc-v5.md` — slash command for v5 pickup; under 5 lines of body.
- `commands/mc-v5-resume.md` — resume command with the canonical short prompt from §1.
- `lib/v5/build-pickup-prompt.mjs` — `buildPrompt({slug, stage})` returns the ≤5-line string.
- `tests/v5-pickup-prompt.test.mjs` — verifies output is ≤5 lines and contains slug + path + router instruction.

**Acceptance:**
- Output of build-pickup-prompt is ≤5 lines.
- The skill markdown contains routing instructions but defers actual content to the routed documents.
- A subagent given the prompt + no other context can find its way to the right files (manual review).

---

## Task 11 — Brainstorming flow: research-then-diagram

**Goal:** Implement §4 of REFACTOR-REQUIREMENTS, matching diagram 04.

**Files to create:**
- `skills/mc-v5-brainstorm/SKILL.md` — v5 brainstorming skill: asks the user, offers research, dispatches research, transforms patterns into a UX flow diagram using Task-1 ux-flow template, saves to `control/v5/features/{slug}/ux-flow.html`, auto-launches dashboard (Task 7).
- `lib/v5/pattern-to-diagram.mjs` — `patternsToUxFlow(patterns)` returns HTML using the template.
- `tests/v5-pattern-to-diagram.test.mjs`

**Acceptance:**
- Given an array of pattern objects, returns a valid HTML file using the ux-flow template.
- Generated HTML's selectable options match the patterns.
- Skill markdown says "always offer research".

---

## Task 12 — MVVM enforcement in build subagent

**Goal:** Implement §10 of REFACTOR-REQUIREMENTS.

**Files to create:**
- `skills/mc-v5-build/SKILL.md` — v5 build subagent skill. Replaces v4 mc-build for v5 features. Requires MVVM separation. Spec reviewer checks for boundary violations.
- `control/v5/routing/ARCHITECTURE.md` — extend with explicit MVVM rules (file naming, import rules).
- `lib/v5/mvvm-lint.mjs` — `lintMVVM(diff)` returns an array of issues (e.g., "View imports Model directly").
- `tests/v5-mvvm-lint.test.mjs`

**Acceptance:**
- mvvm-lint catches: View importing Model directly, business logic in View component, missing ViewModel boundary.
- Build subagent skill explicitly instructs to follow `{feature}.model.ts`, `{feature}.view.tsx`, `{feature}.viewmodel.ts` naming.

---

## Task 13 — Parallel-by-default orchestrator skill

**Goal:** Implement §11 of REFACTOR-REQUIREMENTS.

**Files to create:**
- `skills/mc-v5/parallel-execution.md` — sub-skill of mc-v5 that articulates the parallelization rules (research / explore / plan / build / review parallelism, dependency detection).
- `lib/v5/dependency-graph.mjs` — `analyzeTasks(tasks)` returns `{ parallel: [[...], [...]], sequential: [...] }` grouping tasks.
- `tests/v5-dependency-graph.test.mjs`

**Acceptance:**
- analyzeTasks groups tasks touching disjoint files into the same parallel batch.
- Tasks with explicit `dependsOn` field are sequential.
- Skill markdown is referenced from mc-v5 SKILL.md and instructs the orchestrator to "dispatch all independent tasks at once".

---

## Task 14 — Migration + version bump

**Goal:** Tie v5 into the upgrade system per the user's "Bump to v5.0.0, add migrations" decision.

**Files to create/edit:**
- `migrations/5.0.0-v5-refactor.mjs` — installs the v5 directory skeleton in user projects on upgrade.
- `kit-manifest.json` — version bumped to 5.0.0; migrations list includes the new entry.
- `package.json` — version bumped to 5.0.0.
- `.claude-plugin/plugin.json` — plugin name/version updated to reflect v5 (without breaking the v4 plugin id; add v5 as additional metadata field rather than overwriting).
- Test: `tests/v5-migration.test.mjs`

**Acceptance:**
- Running the migration on a v4 project adds the `control/v5/` skeleton without touching `control/` v4 content.
- Test passes.
- kit-manifest validates.

---

## Task 15 — End-to-end smoke test

**Goal:** Implement §8 acceptance + §Implementation Order #10.

**Files to create:**
- `tests/v5-e2e.test.mjs` — orchestrates a full flow against the sample-project:
  1. Start v5 dashboard server pointed at `sample-project/control/v5/`.
  2. GET `/api/v5/features` → expect four features.
  3. POST decisions to `team-collab`, verify file write.
  4. GET dashboard HTML → assert three sections + filter pills.
  5. GET `/feature/team-collab` → assert tabs render.

**Acceptance:**
- `node --test tests/v5-e2e.test.mjs` passes.
- Test cleans up the spawned server.

---

## Final review

After all tasks complete:
- Dispatch a final code-review subagent across the whole v5 surface (`control/v5/`, `lib/v5/`, `skills/mc-v5*`, `commands/mc-v5*.md`, `control/scripts/v5/`, `control/layout/diagrams/`).
- Verify all acceptance criteria above.
- Use `superpowers:finishing-a-development-branch` to decide merge strategy.

---

## Out of scope for this branch

- Deleting v4 code (user chose to keep v4 alongside v5).
- Mobile dashboard.
- Multi-user collaboration.
- Real-time sync.
- Changing pipeline stage names (braindump → explore → ... → validate).
