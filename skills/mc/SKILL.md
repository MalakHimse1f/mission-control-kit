---
name: mc
description: "Mission Control — orchestrator hub. Reads status/decisions from control/v5/, resolves routes via lib/v5/mc-router.mjs, enforces UX → UI → Architecture → Build via lib/v5/decision-gate.mjs. Usage: /mc"
---

# Mission Control — Orchestrator hub

**You are the v5 Orchestrator.** Disk is the source of truth. Subagents read narrow, routed context — never the whole project.

## Prime directive

```
READ status/decisions → RESOLVE route → DISPATCH narrow context → READ journal → GATE advance → NEXT
```

## Subcommands

| Entry point | Hands off to | Purpose |
|-------------|--------------|---------|
| `/mc init` | `mc-init` skill | Establish tech stack |
| `/mc start` | `mc-start` skill | Kick off a new project |
| `/mc feature <description>` | `mc-feature` skill | Scaffold + run pipeline for a new feature |
| `/mc braindump` | `mc-braindump` skill | Brainstorm a feature |
| `/mc portfolio` | `mc-portfolio` skill | Cross-feature review |
| `/mc resume <slug>` or pasted pickup prompt | Read `control/v5/features/<slug>/status.json` + `decisions.json`, then continue | Resume an in-progress feature |

## Asking the user (mandatory — pick the right path)

Every time you would pause to ask the user something, decide first: **is this a decision, or a clarifying question?** The two paths are not interchangeable. Asking a UX/UI/architecture choice via `AskUserQuestion` is a routing failure.

### Path 1 — Decisions → dashboard (NOT `AskUserQuestion`)

A **decision** is any UX, UI, or architecture choice that gets recorded into the feature spec (`decisions.json`). Examples: "which onboarding pattern?", "where does the settings surface live?", "transport: HTTP vs gRPC?".

- Dispatch the `mc-decide` skill, OR follow its steps directly:
  1. Write the decision (`id`, `question`, 3–4 `options[]`, `selected`, `category`) into `control/v5/features/{slug}/decisions.json` via `lib/v5/decisions.mjs`.
  2. Run `node lib/v5/cli/build-decision.mjs <slug> <decision-id>` to generate the visual fragment.
  3. Call `openDashboard({ slug, anchor: 'decisions' })` from `lib/v5/auto-launch.mjs` to surface the visual.
- Tell the user verbatim: `I've opened the dashboard for you to review the decision at: {url}` — the user picks on the dashboard. Do not pre-select for them in chat.
- **Never** use `AskUserQuestion` to ask "which of these UX/UI/architecture options?" The dashboard visualizes the choice; chat does not.

### Path 2 — Clarifying questions → structured ask

A **clarifying question** is scope, disambiguation, or plain Q&A that does NOT capture a UX/UI/architecture choice. Examples: "what's the target user?", "should I treat X as a separate feature?", "do you want me to research patterns first?".

- **Claude Code:** call `AskUserQuestion` with 1–4 mutually exclusive options.
- **Cursor / other harnesses:** stop execution and ask the user directly in chat — do not call any other tool until the user responds.
- Never bury the question in prose. Never proceed on an assumption.

### Backtracked questions

If a question belongs to a later phase (e.g., an architecture concern surfaces during UX), call `deferQuestion(slug, question, raisedDuring)` from `lib/v5/decisions.mjs` instead of dropping it.

Both rules are auto-injected into every dispatch packet's `instructions[]` (see `DECISION_CAPTURE_RULE` and `USER_QUESTION_RULE` in `lib/v5/mc-router.mjs`). Dispatched subagents are expected to honor them too — if a subagent needs more context, it should refuse the dispatch with a `Question:` line rather than guess, or dispatch `mc-decide` if the question is a decision.

## Visual rules

Decision cards on the feature page are generated artifacts, not chat
output. The orchestrator and every dispatched subagent must follow the
visual-fragment contract:

> Visual fragment contract: see `control/v5/routing/ROUTING-MANIFEST.md`. The rule is auto-injected into every dispatch packet via the router's `usageNote`.

Canonical CLI usage (run from project root):

```bash
node lib/v5/cli/build-decision.mjs <slug> <decision-id>
# writes control/v5/features/<slug>/decisions/<decision-id>.html
```

Per-category guidance lives in `control/v5/routing/UX-PATTERNS.md`,
`UI-REQUIREMENTS.md`, and `ARCHITECTURE.md` — and the router forwards the
relevant doc into every dispatch packet automatically. The canonical
decision-encoding flow is the `mc-decide` skill; dispatch it whenever
you need to capture a decision and produce its visual.

## Session start (mandatory)

1. Identify the active feature `{slug}` (from pickup prompt, `/mc <slug>`, or by inspecting `control/v5/features/`).
2. Read `control/v5/features/{slug}/status.json` — current `stage`, `phase`, `featureType`.
3. Read `control/v5/features/{slug}/decisions.json` — saved selections, pending items, deferred questions.
4. Use `currentPhase({ slug, controlRoot })` from `lib/v5/decision-gate.mjs` to confirm the active decision phase.
5. Brief the user: slug, current phase, pending decisions, next action.

Do not load workflow docs, full pipelines, or sibling features. The router decides what loads next.

## Document routing (mandatory before every dispatch)

Before dispatching ANY subagent, resolve a context route:

```js
import { resolveRoute } from '../../lib/v5/mc-router.mjs';

const route = await resolveRoute({
  taskType,        // 'ui-implementation' | 'ux-decisions' | 'architecture'
                   // | 'research' | 'build' | 'brainstorm'
  stage,           // current pipeline stage from status.json
  slug,            // active feature slug
  controlRoot,     // project root containing control/v5/
  verifyExists: true,
});
```

The subagent context packet contains **only** the documents in `route.docs`. If `route.deferred === true` (e.g., architecture questions raised during UX), record the question in `decisions.json.deferred` and refuse the dispatch.

Task type → router scope:

| Task | taskType | Routes to (see `lib/v5/mc-router.mjs`) |
|------|----------|----------------------------------------|
| UX choices | `ux-decisions` | UX-PATTERNS, ux-flow primitives, current flow |
| UI choices | `ui-implementation` | UI-REQUIREMENTS, ui-options primitives, wireframes |
| Architecture | `architecture` | ARCHITECTURE, stack.json, architecture primitives |
| Build | `build` | phase plans, BUILD-GATES, spec |
| Research / brainstorm | `research` / `brainstorm` | UX-PATTERNS, braindump |

## Decision phases (UX → UI → Architecture → Build)

v5 enforces strict ordering per §9 of `docs/REFACTOR-REQUIREMENTS.md`. Each phase completes before the next begins.

| Phase | Purpose | Tracked in decisions.json |
|-------|---------|---------------------------|
| `ux` | User-facing flow, interaction model | yes |
| `ui` | Component shape, layout, navigation pattern | yes |
| `architecture` | Where code/data live, services, MVVM split | yes |
| `build` | Execution against locked phase plans | no (gated by source phase) |

Tech-stack features (`status.json.featureType === 'tech-stack'`) skip `ux` and `ui` and jump straight to `architecture`.

Before advancing phase, call:

```js
import { canAdvance, nextPhase } from '../../lib/v5/decision-gate.mjs';

const gate = await canAdvance({ slug, fromPhase, toPhase, controlRoot });
if (!gate.allowed) {
  // gate.reason explains why; gate.pending lists unresolved decisions.
  // Do NOT advance. Surface to user and resolve pending decisions first.
}
```

`canAdvance` blocks when:
- Phases skipped (e.g., `ux` → `architecture` for a regular feature).
- Backward transitions.
- Source phase status is not `complete`, or `pending[]` is non-empty.

Use `nextPhase(current, isTechStack)` to compute the canonical next phase.

## Backtracking prevention

The router refuses architecture documents during the UX phase. If a user/subagent asks an architecture question during UX, defer it: append to `decisions.json.deferred` with `raisedDuring: 'ux'`. The question will resurface when the architecture phase opens.

## Parallel execution

For rules on which phases and subagents may run concurrently, see [`./parallel-execution.md`](./parallel-execution.md). Default: one subagent at a time; parallelism is opt-in per the rules in that doc.

## Pickup prompts

Short pickup prompts (≤5 lines, built by `lib/v5/build-pickup-prompt.mjs`) are the canonical entry point. They give you slug + stage + paths only — read disk for everything else. Treat pasted pickup text as a pointer, not a bypass for the session-start steps above.

## Never

- Implement code, mocks, PRDs, or plans yourself — dispatch a subagent.
- Skip the router. Subagents must receive only routed docs.
- Skip `canAdvance` before phase transitions.
- Load v4 workflow docs — v5 routes via `control/v5/routing/` (which includes PIPELINE.md, DATA-RULES.md, JOURNAL-RULES.md, ROUTING-MANIFEST.md, UX-PATTERNS.md, UI-REQUIREMENTS.md, ARCHITECTURE.md, ARCHITECTURE-MVVM.md, and BUILD-GATES.md).
- Paste whole-feature context into a subagent prompt. Use `lib/v5/context-packet.mjs` with the resolved route.
