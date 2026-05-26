# Routing Manifest

Maps task types to the documents a subagent needs, so dispatch packets contain only the relevant context. Implements §2 (Document Routing) and §9.4 (backtracking prevention) of `docs/REFACTOR-REQUIREMENTS.md`. Visual reference: `docs/v5-diagrams/01-document-routing.html`.

The router lives at `lib/v5/mc-router.mjs`. Context packet assembly lives at `lib/v5/context-packet.mjs`.

---

## Route Table

| Task Type | Path | Scope | Optional |
|-----------|------|-------|----------|
| `ui-implementation` | `control/v5/routing/UI-REQUIREMENTS.md` | `ui-requirements` | no |
| `ui-implementation` | `control/layout/diagrams/ui-options/template.html` | `ui-primitives` | no |
| `ui-implementation` | `control/v5/features/{slug}/layout/wireframes/` | `wireframes` | yes |
| `ux-decisions` | `control/v5/routing/UX-PATTERNS.md` | `ux-patterns` | no |
| `ux-decisions` | `control/layout/diagrams/ux-flow/template.html` | `ux-primitives` | no |
| `ux-decisions` | `control/v5/features/{slug}/ux-flow.html` | `current-flow` | yes |
| `architecture` | `control/v5/routing/ARCHITECTURE.md` | `architecture` | no |
| `architecture` | `control/v5/tech-stack/stack.json` | `stack` | yes |
| `architecture` | `control/layout/diagrams/architecture/template.html` | `architecture-primitives` | no |
| `research` | `control/v5/routing/UX-PATTERNS.md` | `patterns` | no |
| `research` | `control/v5/features/{slug}/braindump.md` | `user-spec` | yes |
| `build` | `control/v5/features/{slug}/phases/` | `phase-plans` | no |
| `build` | `control/v5/routing/BUILD-GATES.md` | `build-gates` | no |
| `build` | `control/v5/features/{slug}/spec.md` | `spec` | yes |
| `brainstorm` | `control/v5/routing/UX-PATTERNS.md` | `patterns` | no |
| `brainstorm` | `control/v5/features/{slug}/braindump.md` | `product-context` | yes |

`{slug}` tokens are substituted by `resolveRoute` when a `slug` argument is provided. Optional docs may not exist on disk (per-feature scratch files that only materialize once the feature has produced output) and are skipped silently by the context-packet builder.

---

## Resolution Algorithm

`resolveRoute({ taskType, stage, slug, controlRoot, verifyExists })` runs the following:

1. **Validate** `taskType` against `TASK_TYPE_ROUTES`. Unknown types throw a descriptive error listing the supported set.
2. **Check for backtracking** (§9.4). If `stage === 'ux'` and `taskType === 'architecture'`, return:
   ```js
   { taskType, stage, docs: [], deferred: true,
     deferredReason: 'Architecture documents are not loaded during UX phase. The question will be deferred until the architecture phase.' }
   ```
   No other backtracking pair exists today — UX → UI and UI → architecture progressions are forward-only.
3. **Substitute `{slug}`** in each route entry. If a path contains `{slug}` but no slug was provided, leave the literal token in place and emit a `console.warn`.
4. **Optionally verify existence**. If `verifyExists: true`, each doc gains an `exists` boolean determined by `fs.access`. Disabled by default to keep route resolution synchronous-feeling.
5. **Return** `{ taskType, stage, docs: [{ path, scope, optional, exists? }], deferred: false, deferredReason: null }`.

`buildPacket({ task, route, stage, slug, controlRoot })` adds:

- File-size based `tokensEstimate` (`Math.ceil(totalBytes / 4)`).
- Per-doc `bytes` and `exists` flags.
- Forwarding of `deferred` / `deferredReason` from the route.
- Missing docs emit `console.warn` and are skipped — never thrown.

Directories (e.g., `phases/`, `wireframes/`) are sized by summing their immediate file children. We don't recurse to keep sizing cheap.

---

## Example Resolved Routes

### `ui-implementation` for feature `settings-panel`

```js
await resolveRoute({ taskType: 'ui-implementation', slug: 'settings-panel' });
// =>
{
  taskType: 'ui-implementation',
  stage: null,
  deferred: false,
  deferredReason: null,
  docs: [
    { path: 'control/v5/routing/UI-REQUIREMENTS.md',                              scope: 'ui-requirements', optional: false },
    { path: 'control/layout/diagrams/ui-options/template.html',                   scope: 'ui-primitives',   optional: false },
    { path: 'control/v5/features/settings-panel/layout/wireframes/',              scope: 'wireframes',      optional: true  },
  ],
}
```

### `ux-decisions` for feature `onboarding`

```js
await resolveRoute({ taskType: 'ux-decisions', slug: 'onboarding' });
// =>
{
  taskType: 'ux-decisions',
  docs: [
    { path: 'control/v5/routing/UX-PATTERNS.md',                    scope: 'ux-patterns',  optional: false },
    { path: 'control/layout/diagrams/ux-flow/template.html',        scope: 'ux-primitives', optional: false },
    { path: 'control/v5/features/onboarding/ux-flow.html',          scope: 'current-flow',  optional: true  },
  ],
  deferred: false,
}
```

### `architecture` during the `architecture` stage

```js
await resolveRoute({ taskType: 'architecture', stage: 'architecture', slug: 'payments' });
// =>
{
  taskType: 'architecture',
  stage: 'architecture',
  docs: [
    { path: 'control/v5/routing/ARCHITECTURE.md',                       scope: 'architecture',             optional: false },
    { path: 'control/v5/tech-stack/stack.json',                         scope: 'stack',                    optional: true  },
    { path: 'control/layout/diagrams/architecture/template.html',       scope: 'architecture-primitives',  optional: false },
  ],
  deferred: false,
}
```

### `architecture` during the `ux` stage — **deferred**

```js
await resolveRoute({ taskType: 'architecture', stage: 'ux', slug: 'payments' });
// =>
{
  taskType: 'architecture',
  stage: 'ux',
  docs: [],
  deferred: true,
  deferredReason: 'Architecture documents are not loaded during UX phase. The question will be deferred until the architecture phase.',
}
```

### `research` for feature `analytics`

```js
await resolveRoute({ taskType: 'research', slug: 'analytics' });
// =>
{
  taskType: 'research',
  docs: [
    { path: 'control/v5/routing/UX-PATTERNS.md',                  scope: 'patterns',  optional: false },
    { path: 'control/v5/features/analytics/braindump.md',         scope: 'user-spec', optional: true  },
  ],
}
```

### `build` for feature `checkout`

```js
await resolveRoute({ taskType: 'build', slug: 'checkout' });
// =>
{
  taskType: 'build',
  docs: [
    { path: 'control/v5/features/checkout/phases/',          scope: 'phase-plans', optional: false },
    { path: 'control/v5/routing/BUILD-GATES.md',             scope: 'build-gates', optional: false },
    { path: 'control/v5/features/checkout/spec.md',          scope: 'spec',        optional: true  },
  ],
}
```

### `brainstorm` for feature `referrals`

```js
await resolveRoute({ taskType: 'brainstorm', slug: 'referrals' });
// =>
{
  taskType: 'brainstorm',
  docs: [
    { path: 'control/v5/routing/UX-PATTERNS.md',                  scope: 'patterns',         optional: false },
    { path: 'control/v5/features/referrals/braindump.md',         scope: 'product-context',  optional: true  },
  ],
}
```

---

## Example Context Packet

```js
const route  = await resolveRoute({ taskType: 'ui-implementation', slug: 'settings-panel' });
const packet = await buildPacket({
  task:        'Build the settings panel layout',
  route,
  stage:       'ui',
  slug:        'settings-panel',
  controlRoot: '/Users/me/proj',
});
// =>
{
  task:        'Build the settings panel layout',
  stage:       'ui',
  slug:        'settings-panel',
  route: {
    taskType: 'ui-implementation',
    docs: [
      { path: 'control/v5/routing/UI-REQUIREMENTS.md',                            scope: 'ui-requirements', optional: false, exists: true,  bytes: 4123 },
      { path: 'control/layout/diagrams/ui-options/template.html',                 scope: 'ui-primitives',   optional: false, exists: true,  bytes: 8420 },
      { path: 'control/v5/features/settings-panel/layout/wireframes/',            scope: 'wireframes',      optional: true,  exists: false, bytes: 0    },
    ],
  },
  tokensEstimate: 3136,
  deferred:       false,
  deferredReason: null,
}
```

---

## Backtracking Prevention (§9.4)

The pipeline runs **UX → UI → Architecture → Build**. Once UX has produced decisions, jumping back into architecture mid-UX-phase fragments the conversation and re-opens already-closed questions.

The router enforces this with a single guard today: if `stage === 'ux'` and `taskType === 'architecture'`, the route is returned with `deferred: true` and an empty `docs[]`. The orchestrator is expected to call `deferQuestion(slug, question, 'ux')` from `lib/v5/decisions.mjs` to capture the question so it can be re-raised during the architecture phase.

Other pairs are not deferred — only the architecture-during-UX case. Future stages may add more pairs by extending the `shouldDefer()` function in `lib/v5/mc-router.mjs`.

---

## Extensibility — Adding a New Task Type

The route table is the single source of truth. To add a new task type:

1. Open `lib/v5/mc-router.mjs`.
2. Add a key to the `TASK_TYPE_ROUTES` map:

   ```js
   export const TASK_TYPE_ROUTES = Object.freeze({
     // ...existing types...
     'security-audit': [
       { path: 'control/v5/routing/SECURITY.md',                    scope: 'security-policy',  optional: false },
       { path: 'control/v5/features/{slug}/threat-model.md',        scope: 'threat-model',     optional: true  },
     ],
   });
   ```
3. The new type is automatically picked up by `listTaskTypes()`, `resolveRoute(...)`, and `buildPacket(...)`. No other code needs to change.
4. (Optional) Add a row to the Route Table above for documentation.
5. (Optional) Add a test in `tests/v5-router.test.mjs` verifying the new route resolves correctly.

If the new task type should defer during a particular stage, extend `shouldDefer()` in the same file with a new branch.

---

## Validation Rules

A route entry is valid when:

- `path` is a non-empty string. Relative paths are interpreted relative to the project root (the directory containing `control/v5/`).
- `scope` is a short, kebab-or-camel tag used for logging and UI display.
- `optional` is a boolean. Optional docs may be missing on disk; non-optional docs are expected to exist and emit a `console.warn` when missing during packet build.
- `path` may contain `{slug}`; the router substitutes it at resolve time.

Unknown task types throw at `resolveRoute` time; this is intentional so callers fail fast.

---

## Related Files

- `lib/v5/mc-router.mjs` — implementation of `resolveRoute`, `listTaskTypes`, `TASK_TYPE_ROUTES`.
- `lib/v5/context-packet.mjs` — implementation of `buildPacket`.
- `lib/v5/decisions.mjs` — `deferQuestion(slug, question, raisedDuring)` for backtracked questions.
- `tests/v5-router.test.mjs` — node:test coverage for both modules.
- `docs/v5-diagrams/01-document-routing.html` — visual reference for the routing pipeline.
- `docs/REFACTOR-REQUIREMENTS.md` §2 — origin requirements.
