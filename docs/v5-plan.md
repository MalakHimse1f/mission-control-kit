# Mission Control Kit v5 — As-Built Spec

> Status: shipping. Kit version `5.0.0`. This document is the canonical
> reference for v5 as it exists today. The original execution plan that
> predates implementation has been retired — for the "why" behind each
> piece, see the diagram set under `docs/v5-diagrams/`.

---

## 1. Overview

Mission Control Kit v5 is a disk-first orchestration pipeline for AI coding
agents. Its single insight is that **context rot is the enemy: the
orchestrator should NEVER rely on chat history.** Everything an orchestrator
or subagent needs to resume work — feature status, decisions, deferred
questions, phase plans, the rule about not hand-writing decision HTML — lives
on disk and is retrieved through a small, typed routing layer.

The audience is the orchestrator agent: a Claude instance running inside
Claude Code, dispatching subagents one feature at a time. The user never types
v5 internals; they type `/mc-v5` (or paste a pickup prompt), and the
orchestrator reads everything it needs from disk.

**v5 vs v4.** v5 ships alongside v4. The v4 pipeline (`skills/mc`,
`commands/mc.md`, `control/scripts/dashboard-server.mjs`) is untouched and
keeps working. v5 is additive and is the recommended pipeline going forward.
The migration (`migrations/5.0.0-v5-refactor.mjs`) installs the v5 skeleton
into existing v4 projects on `mc-upgrade` and is idempotent.

**Diagram set.** The visual reference for v5 lives at
`docs/v5-diagrams/01-09*.html` and covers:

| # | Title | Implements |
|---|-------|------------|
| 01 | Document Routing & Data Flow | `lib/v5/mc-router.mjs`, `lib/v5/context-packet.mjs` |
| 02 | Data Storage Architecture | `control/v5/` on-disk layout |
| 03 | Interactive Decisions | feature page Decisions tab |
| 04 | Brainstorming UX Flow | `skills/mc-v5-brainstorm`, `lib/v5/pattern-to-diagram.mjs` |
| 05 | Dashboard Auto-Launch Flow | `lib/v5/auto-launch.mjs`, `lib/v5/launch-server.mjs` |
| 06 | Dashboard | `control/scripts/v5/render-dashboard.mjs` |
| 07 | Feature Presentation | `control/scripts/v5/render-feature.mjs` |
| 08 | Decision Sequencing | `lib/v5/decision-gate.mjs` |
| 09 | Org Orchestrator (Tech Stack) | tech-stack feature path |

---

## 2. Core architectural principles

1. **Pickup prompt = 2 sentences max.** All resumption context comes from disk
   via the router. The prompt names the slug, stage, and taskType. Nothing
   else.
2. **Routing is the orchestrator's brain.** `taskType` → minimum doc set,
   computed at dispatch time by `resolveRoute`. Subagents see only what the
   route gives them.
3. **No backtracking.** UX → UI → Architecture → Build. Phase gates
   (`canAdvance`) refuse skips and reverses; the router refuses to load
   later-phase docs while an earlier phase is open.
4. **Every decision is a visual artifact.** Subagents NEVER hand-write decision
   HTML. They shell out to `node lib/v5/cli/build-decision.mjs <slug>
   <decision-id>`, which writes a sibling `decisions/{id}.html` fragment.
5. **Parallel by default.** `analyzeTasks` groups disjoint work into parallel
   batches. The orchestrator dispatches whole batches in one `tool_use` block.
6. **MVVM separation.** Build subagents follow
   `{feature}.{model,view,viewmodel}.{ts,tsx}` and are lint-checked by
   `lib/v5/mvvm-lint.mjs`.
7. **`controlRoot` is the PROJECT ROOT.** Universally. Every API in `lib/v5/*`
   that takes a `controlRoot` expects the directory that *contains*
   `control/v5/`, not `control/v5/` itself. Misuse is the single biggest
   footgun and is documented in every relevant header.

---

## 3. File layout (the v5 surface)

### Kit-level (this repository)

```
lib/v5/                                kit engine — stdlib-only ESM
  auto-launch.mjs                      openDashboard({slug, anchor, controlRoot})
  auto-launch-helpers.mjs              buildTargetUrl, getOpenCommand
  build-pickup-prompt.mjs              buildPickupPrompt({slug, stage, taskType?})
  context-packet.mjs                   buildPacket({task, route, stage, slug, controlRoot})
  current-task.mjs                     currentTask / nextPendingTask
  dashboard-data.mjs                   loadDashboardData → bucketed feature data
  decision-gate.mjs                    canAdvance, currentPhase, nextPhase, isTechStackFeature
  decision-visual-builder.mjs          buildVisualFragment(decision)
  decisions.mjs                        readDecisions, writeDecisions, markPhaseComplete, deferQuestion, getPhaseStatus
  decisions-schema.mjs                 DECISIONS_SCHEMA, validateDecisions, PHASE_KEYS
  defer-question.mjs                   deferQuestion wrapper + isTechStackQuestion heuristic
  dependency-graph.mjs                 analyzeTasks → parallel batches, detectFileConflicts
  feature-data.mjs                     loadFeatureData (decisions + docs bundle, with fragments)
  feature-docs.mjs                     loadAllDocs (spec/tasks/phases/journal/explore/wireframes)
  launch-server.mjs                    ensureRunning({controlRoot}) → spawn detached server
  lint-decisions.mjs                   lintDecisions / lintAllFeatures
  mc-router.mjs                        TASK_TYPE_ROUTES, resolveRoute, stageToDefaultTaskType
  mvvm-lint.mjs                        lintMVVM(diff), lintFiles({root, files})
  pattern-to-diagram.mjs               patternsToUxFlow(patterns, {slug}) → ux-flow.html
  server-port.mjs                      port-claim helpers, status file path
  surface-deferred.mjs                 surfaceDeferred / markDeferredResolved
  cli/
    build-decision.mjs                 CLI: write features/{slug}/decisions/{id}.html

control/scripts/v5/                    HTTP server + page renderers
  dashboard-server.mjs                 node:http server, routes, port-claim
  dashboard.css                        dashboard styles
  dashboard-client.js                  dashboard client behaviour
  feature.css                          feature page styles (731 lines)
  feature-client.js                    feature page tab/save behaviour
  render-dashboard.mjs                 renderDashboard(data) → HTML
  render-feature.mjs                   renderFeature({slug, data}) → HTML
  render-docs.mjs                      markdown → HTML for spec/journal/phases/explore/wireframes

control/layout/diagrams/               diagram primitives (shared across v4 + v5)
  _shared/diagram.css                  visual styles for .mc-options-grid / .mc-arch-node / .mc-flow-timeline / .mc-mini-frame
  _shared/diagram-select.js            client-side radio selection on diagrams
  _shared/decisions-client.js          inline save script POSTing to /api/v5/decisions/:slug
  architecture/template.html           per-category primitive: arch-node graph
  architecture/README.md
  ui-options/template.html             per-category primitive: mini-frame mockup
  ui-options/README.md
  ux-flow/template.html                per-category primitive: flow-timeline
  ux-flow/README.md

control/v5/routing/                    canonical routing docs (also installed into projects by migration)
  ROUTING-MANIFEST.md                  contract doc + route table + visual-fragment rule
  UX-PATTERNS.md                       UX route: mc-flow-timeline guidance
  UI-REQUIREMENTS.md                   UI route: mc-mini-frame guidance
  ARCHITECTURE.md                      architecture route: mc-arch-node guidance
  ARCHITECTURE-MVVM.md                 MVVM rules + lint contract (auto-loaded into build route)
  BUILD-GATES.md                       phase-completion gates

skills/                                Claude Code skill bundles
  mc-v5/SKILL.md                       Orchestrator hub
  mc-v5/parallel-execution.md          parallel dispatch rules
  mc-v5-brainstorm/SKILL.md            brainstorming + research → ux-flow.html
  mc-v5-decide/SKILL.md                canonical decision-encoding flow
  mc-v5-build/SKILL.md                 stage-5 build with MVVM enforcement
  mc-v5-review/SKILL.md                auto-launch dashboard on artifact events

commands/
  mc-v5.md                             slash command → invokes mc-v5 skill
  mc-v5-resume.md                      slash command → resume with $ARGUMENTS

migrations/
  5.0.0-v5-refactor.mjs                installs control/v5/ skeleton into a project

control/vendor/manifest.json           bundled community skill packages
tests/v5-*.test.mjs                    21 test files, 357 tests
docs/v5-diagrams/01-09*.html           canonical visual reference set
```

### Per-project (`control/v5/`)

This shape is created by `migrations/5.0.0-v5-refactor.mjs` and is what every
v5-aware project carries.

```
control/v5/
  state.json                           { version, activeFeature, features: [...] }
  routing/                             6 routing markdown docs (copies of kit-level)
  features/
    {slug}/
      status.json                      { slug, stage, currentPhase, featureType?, lastUpdatedAt, description, tasks? }
      decisions.json                   canonical decisions schema (see §6)
      braindump.md                     scoping notes
      spec.md                          PRD (produced by prd-generator)
      ux-flow.html                     overall UX flow (produced by patternsToUxFlow)
      architecture-diagram.html        architecture-level diagram (optional)
      decisions/
        {decision-id}.html             per-decision visual fragments (one per decision id)
      phases/
        phase-N.md                     locked task list per phase
      journal/
        NNN-*.md                       chronological build journal
      explore/
        *.{html,md}                    exploration artifacts
      layout/
        wireframes/
          *.html                       wireframe HTML
  tech-stack/
    stack.json                         optional shared tech-stack record
  _diagram-assets/                     copies of _shared/{diagram.css,diagram-select.js,decisions-client.js}

control/.mc/
  v5-dashboard-server.json             ephemeral { port, pid, startedAt } — coexists with v4's dashboard-server.json
```

---

## 4. The pickup prompt protocol

See `docs/v5-diagrams/01-document-routing.html` and
`lib/v5/build-pickup-prompt.mjs`.

`buildPickupPrompt({ slug, stage, taskType? })` returns a 2-sentence string.
The exact emitted text:

```
Resume feature "<slug>" at stage <stage> (taskType: <taskType>). Read
control/v5/features/<slug>/status.json and decisions.json, then call
resolveRoute({ taskType: "<taskType>", stage: "<stage>", slug: "<slug>" })
from lib/v5/mc-router.mjs to load the minimum context for this phase.
```

If `taskType` is not passed, `stageToDefaultTaskType(stage)` is used.

### Why 2 sentences

Anthropic's prompt caching is shared across turns at the *exact-prefix* level.
A long pickup paragraph that drifts text by even a word breaks the cache.
A 2-sentence pickup that always names exactly the same disk paths makes the
*entire* downstream prompt cacheable, and removes any chance of context rot
from chat history accumulating around the resumption point.

### `stageToDefaultTaskType` table

(from `lib/v5/mc-router.mjs`)

| stage value | default taskType |
|-------------|------------------|
| `ux` | `ux-decisions` |
| `ui` | `ui-implementation` |
| `architecture` | `architecture` |
| `build` | `build` |
| `brainstorm` | `brainstorm` |
| `needs-input` | `brainstorm` |
| `ready` | `build` |
| `in-progress` | `build` |
| `complete` | `build` (re-entry for fixes/maintenance) |
| `mock` | `ui-implementation` |
| anything else | `brainstorm` (lightest doc set) |

### How the orchestrator consumes a pickup prompt

1. Parse `slug`, `stage`, `taskType` from the prompt.
2. Read `control/v5/features/{slug}/status.json` and `decisions.json`.
3. Confirm the active phase via `currentPhase({ slug, controlRoot })` from
   `lib/v5/decision-gate.mjs`.
4. Call `resolveRoute({ taskType, stage, slug, controlRoot, verifyExists: true })`
   and dispatch a packet built by `buildPacket(...)`.

---

## 5. Document routing

See `docs/v5-diagrams/01-document-routing.html` and
`control/v5/routing/ROUTING-MANIFEST.md`.

### Task types

(canonical map from `TASK_TYPE_ROUTES` in `lib/v5/mc-router.mjs`)

| taskType | Docs |
|----------|------|
| `ux-decisions` | UX-PATTERNS.md, ux-flow/template.html, features/{slug}/ux-flow.html (optional) |
| `ui-implementation` | UI-REQUIREMENTS.md, ui-options/template.html, features/{slug}/layout/wireframes/ (optional) |
| `architecture` | ARCHITECTURE.md, tech-stack/stack.json (optional), architecture/template.html |
| `research` | UX-PATTERNS.md, features/{slug}/braindump.md (optional) |
| `brainstorm` | UX-PATTERNS.md, features/{slug}/braindump.md (optional) |
| `build` | features/{slug}/phases/, BUILD-GATES.md, ARCHITECTURE-MVVM.md, features/{slug}/spec.md (optional) |

### `resolveRoute` API

```js
import { resolveRoute } from 'lib/v5/mc-router.mjs';

const route = await resolveRoute({
  taskType,            // one of the keys above
  stage,               // 'ux'|'ui'|'architecture'|'build' (or dashboard bucket)
  slug,                // feature slug; substituted into {slug} placeholders
  controlRoot,         // PROJECT ROOT (directory containing control/v5/)
  verifyExists: true,  // optional; adds doc.exists boolean per entry
});
// =>
// {
//   taskType, stage,
//   docs: [{ path, scope, optional, exists? }, ...],
//   usageNote,                          // forwarded into packet.instructions[]
//   deferred: false, deferredReason: null
// }
```

### `PHASE_ORDER` and defer rules

```
PHASE_ORDER = ['ux', 'ui', 'architecture', 'build']
TASK_PHASE_REQUIREMENT = {
  'ux-decisions':    0,   // can run during ux+
  'ui-implementation': 1, // can run during ui+
  architecture:      2,   // can run during architecture+
  build:             3,   // can run during build only
}
```

A request that targets a phase the feature has not yet reached is **deferred**:
the route returns `{ deferred: true, deferredReason, docs: [] }`. Specifically:

- `architecture` task during `ux`/`ui` → deferred.
- `build` task during `ux`/`ui` → deferred.
- `ui-implementation` task during `ux` → deferred.
- `research` and `brainstorm` are advisory; they are NEVER deferred.

When the route is deferred, the orchestrator calls `deferQuestion(slug,
question, raisedDuring)` from `lib/v5/decisions.mjs` so the question is
re-surfaced when the right phase opens (see §8).

### `usageNote` → `instructions[]`

Every route entry has a `usageNote` string. The decision-producing routes
(`ux-decisions`, `ui-implementation`, `architecture`) carry the **visual
fragment rule** (verbatim text in §7). `research` / `brainstorm` / `build`
carry the lighter `ROUTING_DOCS_NOTE`:

> Consult the routing docs in `control/v5/routing/` before producing any
> visual artifacts. Do not hand-author decision card HTML — see the visual
> fragment contract in `control/v5/routing/ROUTING-MANIFEST.md`.

`buildPacket` collects every route's `usageNote` into a top-level
`instructions[]` array. Subagents read this array first — the hard rules
appear in their context regardless of which routed docs they happen to open.

### `controlRoot` semantics

Every `lib/v5/*` API that takes a `controlRoot` expects the **project root**
— the directory containing `control/v5/`. Not `control/v5/` itself. The
helpers `findNearestProjectRoot` (in `decisions.mjs`, `feature-docs.mjs`,
`current-task.mjs`, `server-port.mjs`, `cli/build-decision.mjs`) all walk up
from cwd looking for a child named `control/v5` and return that directory's
parent. This was unified during the v5 refactor and is the single biggest
footgun if a caller passes `control/v5/` (a layer too deep) or
`control/v5/features/{slug}` (two layers too deep).

---

## 6. Decisions schema and lifecycle

See `docs/v5-diagrams/03-interactive-decisions.html` and
`docs/v5-diagrams/02-data-storage.html`.

### Canonical schema

From `lib/v5/decisions-schema.mjs`:

```js
export const PHASE_KEYS = ['ux', 'ui', 'architecture'];
export const PHASE_STATUSES = ['complete', 'in-progress', 'not-started'];

DECISIONS_SCHEMA = {
  type: 'object',
  required: ['feature', 'phases', 'deferred', 'updatedAt'],
  properties: {
    feature: { type: 'string' },
    phases: {
      type: 'object',
      required: PHASE_KEYS,
      properties: {
        ux:           { status, decisions[], pending[] },
        ui:           { status, decisions[], pending[] },
        architecture: { status, decisions[], pending[] },
      },
    },
    deferred: [{
      question: string,
      raisedDuring: 'ux'|'ui'|'architecture',
      raisedAt: string,   // ISO-8601
    }],
    updatedAt: string,    // ISO-8601
  },
  definitions: {
    decision: {
      required: ['id', 'category', 'question', 'options', 'selected', 'decidedAt'],
      properties: {
        id:         string,  // kebab-cased, unique within the feature
        category:   string,  // conventional: 'ux' | 'ui' | 'engineering'
        question:   string,
        options:    string[],
        selected:   string,  // must equal one of options
        decidedAt:  string,  // ISO-8601
      },
    },
  },
};
```

### Read/write API

From `lib/v5/decisions.mjs`:

```js
readDecisions(slug, { controlRoot }) → Promise<object>
  // Returns the default empty structure on ENOENT (does not write it).

writeDecisions(slug, payload, { controlRoot }) → Promise<object>
  // Validates against schema. Atomic: writes to decisions.json.tmp, then rename.
  // Always overwrites updatedAt with new Date().toISOString().
  // Throws if payload.feature is set and !== slug.

markPhaseComplete(slug, phase, { controlRoot }) → Promise<object>
  // Sets phases[phase].status = 'complete', clears phases[phase].pending = [].

getPhaseStatus(slug, { controlRoot }) → Promise<{ ux, ui, architecture }>

deferQuestion(slug, question, raisedDuring, { controlRoot }) → Promise<object>
  // Appends { question, raisedDuring, raisedAt } to deferred[].
```

### Atomic writes

Every write goes through the tmp + rename pattern:

```js
const tmpPath = `${filePath}.tmp`;
await fs.writeFile(tmpPath, JSON.stringify(normalized, null, 2) + '\n', 'utf8');
await fs.rename(tmpPath, filePath);
```

`fs.rename` on POSIX is atomic within the same filesystem, so concurrent
reads will always see either the pre- or post-state, never a torn file.

### How to add a decision (canonical flow)

The orchestrator dispatches the `mc-v5-decide` skill, which performs:

1. Gather inputs from the user (`question`, `options[]`, `selected`, kebab `id`,
   `category` ∈ `{ux, ui, engineering}`).
2. `await writeDecisions(slug, updatedPayload, { controlRoot })` — read-modify-write.
3. `node lib/v5/cli/build-decision.mjs <slug> <decision-id>` (writes the
   sibling fragment).
4. `await openDashboard({ slug, anchor: 'decisions', controlRoot })`.
5. Tell the user verbatim:
   > I've saved the decision and opened the dashboard at: {url}

---

## 7. Visual fragment contract

The single load-bearing rule across all of v5. See
`docs/v5-diagrams/03-interactive-decisions.html` and
`control/v5/routing/ROUTING-MANIFEST.md`.

> **You MUST NOT write HTML for a decision card by hand.** Every decision in
> `decisions.json` requires a sibling fragment file generated by
> `node lib/v5/cli/build-decision.mjs <slug> <decision-id>`. If a decision has
> no fragment, the feature page falls back to plain text cards — this is a
> failure mode, not an acceptable state.

This string lives verbatim in `lib/v5/mc-router.mjs` (the `VISUAL_FRAGMENT_RULE`
constant) and is forwarded into every UX / UI / architecture dispatch packet
via the route's `usageNote`.

### Fragment generation

```bash
node lib/v5/cli/build-decision.mjs <slug> <decision-id> [--control-root <path>]
```

The CLI (`lib/v5/cli/build-decision.mjs`):

1. Resolves `controlRoot` via `--control-root` or by walking up from cwd
   looking for `control/v5/`.
2. Reads `decisions.json` via `readDecisions(slug, { controlRoot })`.
3. Searches `phases.ux/ui/architecture` for a decision whose `id` matches.
4. Calls `buildVisualFragment(decision)` from
   `lib/v5/decision-visual-builder.mjs`.
5. Writes `control/v5/features/{slug}/decisions/{decision-id}.html` atomically.
6. Prints the path on success; exits 1 with a stderr message on failure.

### Fragment shells

`buildVisualFragment(decision)` picks a per-category visual from
`lib/v5/decision-visual-builder.mjs`:

| category | Visual shell | Primitive class |
|----------|--------------|-----------------|
| `ux` | per-option step timeline | `.mc-flow-timeline` |
| `ui` | per-option mini-device mockup | `.mc-mini-frame` (dialog/drawer/sheet variants) |
| `engineering` | per-option arch-node graph | `.mc-arch-node` inside `.mc-diagram-surface` |
| anything else | neutral placeholder | `.mc-arch-node` with "Option N" label |

Every fragment is a single `<div class="mc-options-grid" data-group="<id>"
data-category="<cat>" data-question="<q>">` containing one
`<div class="mc-option-card[ selected]">` per option. The `data-group` value
MUST equal the decision id (the lint enforces this).

### Inlining vs iframing

Fragments are **inlined** into the feature detail page, not iframed. This
keeps the save bar's DOM (`.mc-options-grid` selectors, click handlers in
`feature-client.js`) in the same document as the cards. One DOM, one save
flow, one set of CSS rules from `_shared/diagram.css`.

### Lint: `lib/v5/lint-decisions.mjs`

`lintDecisions({ slug, controlRoot })` walks both `decisions.json` and
`features/{slug}/decisions/*.html` and emits three violation types:

| type | When |
|------|------|
| `missing-fragment` | A decision id appears in decisions.json but no `{id}.html` file exists |
| `orphan-fragment` | A `{name}.html` file exists in `decisions/` but no decision id matches |
| `mismatched-group` | The fragment file's `data-group="..."` does not equal its basename |

`lintAllFeatures({ controlRoot })` runs the per-feature lint across every
directory under `control/v5/features/`.

CLI mode:

```bash
node lib/v5/lint-decisions.mjs [slug] [--control-root <path>]
# exit 0 = clean, exit 1 = violations printed
```

### Where the hard rule lives

| File | What it carries |
|------|-----------------|
| `lib/v5/mc-router.mjs` (`VISUAL_FRAGMENT_RULE`) | the verbatim string |
| `control/v5/routing/ROUTING-MANIFEST.md` | canonical contract doc |
| `control/v5/routing/UX-PATTERNS.md` | per-category guidance (UX) |
| `control/v5/routing/UI-REQUIREMENTS.md` | per-category guidance (UI) |
| `control/v5/routing/ARCHITECTURE.md` | per-category guidance (engineering) |
| `skills/mc-v5/SKILL.md` | orchestrator-side reminder |
| `skills/mc-v5-brainstorm/SKILL.md` | brainstorm-side reminder |
| `skills/mc-v5-decide/SKILL.md` | decision-encoding workflow |
| `skills/mc-v5-build/SKILL.md` | build-side preflight that fills missing fragments |

The text reaches subagents through three independent paths: (a) packet
`instructions[]`, (b) the routing docs they're handed for the phase, (c) the
skill body if a v5 skill is what invoked them.

---

## 8. Decision sequencing (gates)

See `docs/v5-diagrams/08-decision-sequencing.html` and
`lib/v5/decision-gate.mjs`.

### API

```js
import { canAdvance, currentPhase, nextPhase, isTechStackFeature }
  from 'lib/v5/decision-gate.mjs';

await currentPhase({ slug, controlRoot }) → 'ux'|'ui'|'architecture'|'build'
  // Rules:
  // 1. If any tracked phase has status 'in-progress', return that (canonical order).
  // 2. Else if every tracked phase is 'complete', return 'build'.
  // 3. Else return the first tracked phase with status 'not-started'.
  // Tech-stack features only have one tracked phase: 'architecture'.

nextPhase(current, isTechStack) → 'ux'|'ui'|'architecture'|'build'|'done'
  // Regular:    null → ux → ui → architecture → build → done
  // Tech-stack: null → architecture → build → done

await canAdvance({ slug, fromPhase, toPhase, controlRoot })
  → { allowed: boolean, reason: string|null, pending: string[] }
  // Refuses backward / skip / non-canonical transitions.
  // For tracked source phases (ux/ui/architecture), requires
  //   phases[fromPhase].status === 'complete' AND pending.length === 0.

await isTechStackFeature(slug, controlRoot) → boolean
  // True iff status.json.featureType === 'tech-stack'.
```

### Tech-stack bypass

A feature with `status.json.featureType === 'tech-stack'` skips UX and UI
entirely. The phase order collapses to `['architecture', 'build']`.
`canAdvance` additionally accepts `ux → architecture` and `ui → architecture`
for tech-stack features so a feature reclassified mid-flow doesn't deadlock.

### Deferred-question queue

When a question is asked in the wrong phase, it goes into `decisions.json`'s
`deferred[]` array via `deferQuestion(slug, question, raisedDuring,
{ controlRoot })` from `lib/v5/decisions.mjs`.

When a later phase opens, the orchestrator calls:

```js
import { surfaceDeferred, markDeferredResolved } from 'lib/v5/surface-deferred.mjs';

const questions = await surfaceDeferred({ slug, atPhase: 'architecture', controlRoot });
// → only 'architecture' returns anything today.
//   ux/ui/build return [] by design.
```

`isTechStackQuestion(text)` in `lib/v5/defer-question.mjs` is a heuristic
(substring match against `database`, `api`, `infrastructure`, `deployment`,
`framework`, `library`, `service`, `stack`) used by the orchestrator to decide
whether a free-form user question should be deferred during UX/UI.

---

## 9. MVVM enforcement

See `control/v5/routing/ARCHITECTURE-MVVM.md` and `lib/v5/mvvm-lint.mjs`.

### Naming conventions

Three sibling files per feature, in the same directory:

| Layer | File pattern | Imports |
|-------|--------------|---------|
| Model | `{feature}.model.ts` | nothing from View or ViewModel |
| ViewModel | `{feature}.viewmodel.ts` | the Model; never imports a View |
| View | `{feature}.view.tsx` | the ViewModel; never the Model |

`.jsx` / `.js` variants are accepted by the linter (JS-only projects), but
TypeScript is preferred. Do not invent `{feature}-model.ts` or
`{feature}/index.tsx` — the lint and the spec reviewer both rely on these
exact patterns.

### Data flow

```
View   ── user actions ──▶  ViewModel  ── mutations ──▶  Model
   ◀── render (derived) ──             ◀── data ──────
```

The View only sees the ViewModel. The Model only sees itself. The ViewModel
is the only layer that knows about both.

### Lint violation types

`lib/v5/mvvm-lint.mjs` exports `lintMVVM(diff)` and `lintFiles({ root, files })`.
The four violation types:

| type | Detects |
|------|---------|
| `view-imports-model` | A `*.view.{ts,tsx,jsx}` imports from a `*.model` specifier |
| `view-has-data-fetch` | A View contains `fetch(`, `axios.`, `await db.`, or `new XMLHttpRequest(` |
| `model-imports-view` | A `*.model.{ts,tsx,jsx}` imports from a `*.view` specifier |
| `view-missing-viewmodel` | A directory with a `*.view.tsx` but no sibling `*.viewmodel.{ts,tsx,jsx}` |

### Where the rules are auto-loaded

`ARCHITECTURE-MVVM.md` is in the `build` route (NOT the `architecture` route)
and is therefore auto-delivered into every build subagent's dispatch packet
via `lib/v5/mc-router.mjs`. The `architecture` route is about
decision-encoding for the architecture phase; MVVM rules are about code shape
during build. They are intentionally orthogonal.

The build skill (`skills/mc-v5-build/SKILL.md`) requires every task spec to
declare `Layer: Model | View | ViewModel | N/A`, and requires the spec
reviewer to run `mvvm-lint` on every changed file set before approving the
task.

---

## 10. Parallel execution

See `skills/mc-v5/parallel-execution.md` and `lib/v5/dependency-graph.mjs`.

### Core rule

**If work CAN be parallelized, it MUST be parallelized.** Sequential
execution is a deliberate exception (true data dependency, shared file,
schema change), not the default. The orchestrator dispatches every
independent task in a single `tool_use` block so subagents run concurrently.

### `analyzeTasks` API

```js
import { analyzeTasks, detectFileConflicts } from 'lib/v5/dependency-graph.mjs';

const tasks = [
  { id: 'A', files: ['src/a.ts'] },
  { id: 'B', files: ['src/b.ts'], dependsOn: ['A'] },
  { id: 'C', files: ['src/a.ts'] },     // conflicts with A
  { id: 'D', files: [] },               // read-only, batches anywhere
];

const { parallel, sequential } = analyzeTasks(tasks);
// parallel:   [['A', 'D'], ['B', 'C']]  // batches that can run together
// sequential: ['A', 'D', 'C', 'B']      // topo-ordered flat fallback
```

Tasks land in different batches when:

- One explicitly `dependsOn` the other (transitive ok), OR
- They share at least one entry in `files[]`.

Empty `files: []` + no `dependsOn` is a read-only task and can join any batch.

Cycles in `dependsOn` throw at `analyzeTasks` time. Unknown ids in
`dependsOn` throw immediately.

### Concurrency cap

At most **5 parallel subagents per `tool_use` block** — a Claude Code
constraint. If a batch is larger than 5, the orchestrator chunks it and
awaits each chunk before dispatching the next.

### Dispatch pattern

```js
for (const batch of parallel) {
  // Up to 5 ids per batch — emit them as one tool_use block.
  await Promise.all(batch.map((id) => dispatchTask(id)));
}
```

---

## 11. Dashboard server + UI

See `docs/v5-diagrams/05-auto-launch.html` and
`control/scripts/v5/dashboard-server.mjs`.

### Port acquisition

- Range: **9470–9499**. v4's dashboard also uses 9470, so v5 typically lands
  on 9471+ when both are running.
- Strategy: **bind-then-claim**. `startServerInRange` walks ports calling
  `server.listen(p)` directly, retries on `EADDRINUSE`/`EACCES`, and only
  writes the status file *after* `listen` resolves. This eliminates the
  TOCTOU window an older probe→bind flow had.
- Fallback: if every port in the range is busy, `port: 0` (OS-assigned).

### Status file

`{controlRoot}/control/.mc/v5-dashboard-server.json`:

```json
{
  "port": 9471,
  "pid": 12345,
  "startedAt": "2026-05-26T14:00:00.000Z"
}
```

`.mc/` lives under `control/` (not under `control/v5/`) so v4's
`dashboard-server.json` coexists with v5's `v5-dashboard-server.json`.

### Endpoints

| Method | Path | Returns |
|--------|------|---------|
| GET | `/` | full dashboard HTML (`renderDashboard(loadDashboardData(...))`) |
| GET | `/feature/:slug` | feature detail HTML (`renderFeature({slug, data: loadFeatureData(...)})`) |
| GET | `/api/v5/features` | array of `{ slug, stage, status, phases }` |
| GET | `/api/v5/decisions/:slug` | `readDecisions(slug)` |
| POST | `/api/v5/decisions/:slug` | `validateDecisions` → `writeDecisions` → updated record |
| GET | `/dashboard.css`, `/dashboard-client.js` | served from `control/scripts/v5/` |
| GET | `/feature.css`, `/feature-client.js` | served from `control/scripts/v5/` |
| GET | `/diagrams/*` | static files under the project's `control/layout/diagrams/` (kit fallback if missing) |
| * | anything else | 404 JSON |

POST to `/api/v5/decisions/:slug` validates via `validateDecisions` before
delegating to `writeDecisions`; field-level errors come back as
`{ error: 'invalid decisions payload', details: [...] }` with a 400.

### Auto-launch

`openDashboard({ slug, anchor, controlRoot })` from `lib/v5/auto-launch.mjs`:

1. `ensureRunning({ controlRoot })` — spawns the v5 server as a detached
   background process if it isn't already up. Polls the status file until
   `startedAt` is fresh (within 2 s of spawn) or 5 s elapses.
2. Builds the target URL (`/`, `/feature/{slug}`, or `/feature/{slug}#anchor`).
3. Spawns the OS browser-open command (`open` on macOS, `xdg-open` on Linux,
   `start` on Windows). Fire-and-forget — does NOT await browser readiness.
4. Returns `{ url, port, alreadyRunning }`.

---

## 12. The dashboard home page (`/`)

See `docs/v5-diagrams/06-dashboard-mockup.html` and
`control/scripts/v5/render-dashboard.mjs`.

### Sections

1. **Pickup** — top-of-page panel. Resolves the active feature via
   `state.activeFeature` → most-recent in-progress → most-recent
   needs-input. Shows the 2-sentence pickup prompt (built by
   `buildPickupPrompt`) with a copy button.
2. **Live Agents** — every feature with `stage === 'in-progress'`, sorted by
   `lastUpdatedAt` desc.
3. **Up Next** — the most-recent feature with `stage === 'ready'`.
4. **All Items** — every feature, sorted by `lastUpdatedAt` desc.

Every feature row that is not `stage === 'complete'` shows a per-row "Pickup"
button that copies that feature's pickup prompt.

### Filter pills

Counts come from `loadDashboardData(...).filterCounts`:

- `Needs Your Input` (`stage === 'needs-input'`)
- `Ready` (`stage === 'ready'`)
- `In Progress` (`stage === 'in-progress'`)
- `Complete` (`stage === 'complete'`)

### Disclosure

The bottom of the home page carries two disclosure (`<details>`) blocks: a
table of v5 slash commands (`/mc-v5`, `/mc-v5-resume`) and a table of
bundled community skills (see §14 for what's bundled). Both tables have
copy buttons on each row.

### Row anchoring

Every row in Live Agents, Up Next, and All Items is a full `<a href>` anchor
to `/feature/{slug}`. Consistent across all three sections.

---

## 13. The feature detail page (`/feature/{slug}`)

See `docs/v5-diagrams/07-feature-presentation.html` and
`control/scripts/v5/render-feature.mjs`.

### Top-level tabs

Two top tabs: **Decisions** and **Documentation**. Selection is purely
client-side.

### Decisions tab

Three sub-tabs (`UX`, `UI`, `Architecture`). Each sub-tab renders:

- A status pill (`Complete` / `In progress` / `Not started`).
- The list of pending decision titles, if any.
- A `<div class="mc-options-grid">` per decision, **inlined from the fragment
  file** loaded by `loadFeatureData` from
  `features/{slug}/decisions/{id}.html`. If a fragment is missing, the
  renderer falls back to plain text cards — the documented failure mode.

A **sticky save bar** at the bottom of the page is wired to
`feature-client.js`. The flow is:

1. User clicks an option card. `feature-client.js` toggles `.selected` on the
   card and marks the document dirty.
2. User clicks `Save` in the sticky bar.
3. `MCDecisions.save(slug, payload)` POSTs to `/api/v5/decisions/{slug}` with
   the full normalized payload.
4. Server runs `validateDecisions` → `writeDecisions` → returns the saved
   record. Client clears the dirty flag.

### Documentation tab

Six sub-tabs:

| Sub-tab | Source | Renderer |
|---------|--------|----------|
| Spec | `spec.md` | `markdownToHtml` (subset — see §17) |
| Tasks | `status.json.tasks[]` grouped by status | `renderTasks` |
| Phases | `phases/phase-N.md` (sorted by leading number) | `markdownToHtml` per file |
| Journal | `journal/NNN-*.md` (sorted by leading number; `_*` excluded) | `markdownToHtml` per file |
| Explore | `explore/*.{html,md}` | iframe for `.html`, `markdownToHtml` for `.md` |
| Wireframes | `layout/wireframes/*.html` | iframe gallery cards |

All six come from `lib/v5/feature-docs.mjs` via `loadAllDocs(slug)`, called
inside `loadFeatureData`.

---

## 14. Bundled skills (community packages)

Sourced via `control/vendor/manifest.json`. The v5 orchestrator dispatches
these by name; they are not authored here.

| Bundle | id | Skills the v5 pipeline uses | Where in v5 |
|--------|----|-----------------------------|-------------|
| superpowers (Jesse Vincent / obra) | `superpowers` | `brainstorming`, `parallel-web-search`, `parallel-deep-research`, `writing-plans`, `subagent-driven-development`, `verification-before-completion` | brainstorm → research dispatch; build → planner+TDD loop |
| startup-skill (ferdinandobons) | `startup-skill` | `startup-design`, `startup-competitors`, `startup-positioning`, `startup-pitch` | project-start (v4-era; reused in v5) |
| designer-skills (Owl-Listener) | `designer-skills` | `design-research`, `ux-strategy`, `interaction-design`, `visual-critique` | UX/UI decision research |
| prd-generator (jamesrochabrun) | `prd-generator` | `prd-generator` | spec.md generation |

`required-for` per bundle (from the manifest):
- `project-start` → `superpowers`, `startup-skill`
- `add-feature` → `superpowers`, `designer-skills`, `prd-generator`

Attribution is shown in the dashboard home page's disclosure tables (see §12).

---

## 15. Migration + version

### Migration

`migrations/5.0.0-v5-refactor.mjs`, signature
`up({ controlRoot, kitRoot, log? })`. The migration:

1. Creates `control/v5/{routing,features,tech-stack,_diagram-assets}/`.
2. Seeds `control/v5/state.json` if missing.
3. Copies the 6 routing markdown files into `control/v5/routing/`:
   - `ROUTING-MANIFEST.md`
   - `UI-REQUIREMENTS.md`
   - `UX-PATTERNS.md`
   - `ARCHITECTURE.md`
   - `ARCHITECTURE-MVVM.md`
   - `BUILD-GATES.md`
4. Copies `control/layout/diagrams/_shared/{diagram.css, diagram-select.js,
   decisions-client.js}` to `control/v5/_diagram-assets/`.
5. **Idempotent.** `copyIfMissing` skips any destination that already exists
   — rerunning the migration never clobbers user edits.

### Version

- `package.json` — `"version": "5.0.0"`
- `kit-manifest.json` — `"kitVersion": "5.0.0"`, last migration in the list
  is `"5.0.0-v5-refactor"`
- `.claude-plugin/plugin.json` — `"version": "5.0.0"`

---

## 16. Test surface

**357 tests across 21 files** (counts from `node --test tests/v5-*.test.mjs`):

| File | Tests | Subject |
|------|-------|---------|
| `tests/v5-router.test.mjs` | 37 | `TASK_TYPE_ROUTES`, `resolveRoute`, defer rules |
| `tests/v5-sequencing.test.mjs` | 34 | `canAdvance`, `currentPhase`, `nextPhase`, tech-stack |
| `tests/v5-render-docs.test.mjs` | 24 | markdown → HTML, doc bundle rendering |
| `tests/v5-feature-render.test.mjs` | 23 | full feature page HTML |
| `tests/v5-dashboard-render.test.mjs` | 22 | dashboard home HTML |
| `tests/v5-dashboard-server.test.mjs` | 21 | server endpoints, port-claim, static |
| `tests/v5-auto-launch.test.mjs` | 19 | `openDashboard`, `ensureRunning` |
| `tests/v5-feature-docs.test.mjs` | 19 | `loadAllDocs` collectors |
| `tests/v5-decisions.test.mjs` | 17 | read/write/atomic, schema validation |
| `tests/v5-dependency-graph.test.mjs` | 17 | `analyzeTasks`, topo sort, conflicts |
| `tests/v5-mvvm-lint.test.mjs` | 16 | 4 violation types, diff + file-tree modes |
| `tests/v5-pattern-to-diagram.test.mjs` | 16 | `patternsToUxFlow` HTML |
| `tests/v5-pickup-prompt.test.mjs` | 15 | 2-sentence prompt, taskType embedding |
| `tests/v5-cli-build-decision.test.mjs` | 14 | CLI: parse, resolve, write fragment |
| `tests/v5-lint-decisions.test.mjs` | 12 | missing / orphan / mismatched-group |
| `tests/v5-decision-visual-builder.test.mjs` | 10 | per-category fragment shells |
| `tests/v5-current-task.test.mjs` | 10 | `currentTask`, `nextPendingTask` |
| `tests/v5-migration.test.mjs` | 10 | 5.0.0 migration: shape + idempotency |
| `tests/v5-routing-integration.test.mjs` | 9 | end-to-end packet flow (load-bearing) |
| `tests/v5-e2e.test.mjs` | 7 | server boot against sample-project |
| `tests/v5-context-packet.test.mjs` | 5 | `buildPacket` shape, instructions[] |

### Load-bearing integration test

`tests/v5-routing-integration.test.mjs` is the end-to-end contract test: it
builds a route, builds a packet, checks `instructions[]` contains the
visual-fragment rule, and verifies the docs[] paths resolve under the
sample-project's `control/v5/`.

### Drift guards

- `tests/v5-router.test.mjs` asserts the route table matches the
  `ROUTING-MANIFEST.md` table (manifest drift guard).
- `tests/v5-decision-visual-builder.test.mjs` asserts every category in
  `PHASE_KEYS` has a corresponding fragment shell.
- `tests/v5-dependency-graph.test.mjs` covers the parallel-execution doc's
  examples literally.

### E2E

`tests/v5-e2e.test.mjs` boots `dashboard-server.mjs` against
`sample-project/control/v5/` and asserts the four MediaFlow features
(`backlog-prioritization`, `cross-media-search`, `personal-library-import`,
`progress-tracker`) round-trip through the API. The sample project's
`state.json` carries the canonical `activeFeature` pointer used by the
pickup-prompt panel on the dashboard.

---

## 17. Known design choices + tradeoffs

- **`controlRoot` semantics are unified to project-root.** Every caller in
  `lib/v5/*` passes the directory containing `control/v5/`. The
  `findNearestProjectRoot` walk in `decisions.mjs`, `feature-docs.mjs`,
  `current-task.mjs`, `server-port.mjs`, and the CLI all share the same
  contract. The single-letter difference between "the project" and
  "control/v5" was a recurring bug source pre-refactor.
- **The pickup prompt explicitly names the `taskType`.** A fresh agent with
  zero chat history can call `resolveRoute({ taskType, stage, slug })`
  without inferring anything from the stage. Inference is the failure mode
  this rule exists to remove.
- **Diagrams inline, not iframe.** Fragment files are read by
  `loadFeatureData` and inlined into the feature page's HTML by
  `render-feature.mjs`. One DOM means one selector tree for
  `feature-client.js`, one save flow, and no cross-frame click translation.
- **Markdown is a focused subset, not full CommonMark.** `markdownToHtml` in
  `render-docs.mjs` handles ATX headings, blank-line paragraphs (newlines
  collapsed to spaces), unordered and ordered lists, fenced code, inline
  `code`, `**bold**`, `*italic*`. No tables, no nested lists, no link
  syntax, no images. Good enough for the spec / journal / phase content v5
  features actually produce.
- **The dashboard placeholder still exists as a fallback.** If
  `loadDashboardData` throws during early-bootstrap edge cases,
  `dashboard-server.mjs` falls back to a minimal placeholder HTML with the
  error appended as an HTML comment, so the home page never 500s.
- **Build subagent preflight regenerates missing fragments rather than
  failing.** `skills/mc-v5-build/SKILL.md` requires the orchestrator to list
  every decision id, check for the fragment, and shell out to
  `build-decision.mjs` for any that are missing — *before* dispatching the
  first build task. Only if a fragment STILL can't be generated does the
  build stop.

---

## 18. Out of scope (intentionally)

- **Deleting v4.** v4 ships next to v5; the migration is additive. There is no
  v4→v5 data migration path because the two pipelines have different state.
- **Real-time multi-user collaboration.** The dashboard is a single-user
  reviewer surface. The server has no auth, no websockets, no merge logic.
- **Mobile-native UI.** The dashboard is desktop-only; touch targets and
  small-screen reflow are not tuned.
- **Full CommonMark in spec.md.** Markdown link syntax, tables, nested
  lists, images, and reference-style links are intentionally not supported.
  Revisit if real specs start needing them.
- **A v5 → v6 upgrade story.** None drafted. The migration system supports
  future versions; the contract is not yet exercised beyond `5.0.0`.

---

## Cross-reference: where to read next

- `docs/v5-diagrams/01-document-routing.html` — routing pipeline.
- `docs/v5-diagrams/02-data-storage.html` — disk layout.
- `docs/v5-diagrams/03-interactive-decisions.html` — decision visuals.
- `docs/v5-diagrams/04-brainstorming-ux-flow.html` — research → ux-flow.html.
- `docs/v5-diagrams/05-auto-launch.html` — server lifecycle.
- `docs/v5-diagrams/06-dashboard-mockup.html` — home page.
- `docs/v5-diagrams/07-feature-presentation.html` — feature detail page.
- `docs/v5-diagrams/08-decision-sequencing.html` — phase gates.
- `docs/v5-diagrams/09-org-orchestrator.html` — tech-stack feature path.
- `control/v5/routing/ROUTING-MANIFEST.md` — the contract for adding task types.
- `control/v5/routing/ARCHITECTURE-MVVM.md` — the contract for build code shape.
- `skills/mc-v5/SKILL.md` — orchestrator-side rules.
- `skills/mc-v5-decide/SKILL.md` — canonical decision-encoding flow.
- `skills/mc-v5-build/SKILL.md` — stage-5 build with MVVM enforcement.
