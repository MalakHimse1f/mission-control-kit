# Architecture

Decision-visualization guidance for the architecture phase: how the
orchestrator and the `architecture` subagent encode engineering choices,
which diagram primitive backs them, and the single rule about who writes
the HTML.

> MVVM layering rules (file naming, boundary rules, state flow, lint
> contract) live in `ARCHITECTURE-MVVM.md` and are auto-loaded for `build`
> tasks. This document is the architecture-phase counterpart.

## Purpose

This document is loaded into every dispatch packet whose `taskType` is
`architecture`. It tells the receiving subagent how each architectural
decision is shown to the user during the architecture phase — and how
the visual fragment for each option is produced.

## Decision visualization

Architecture decisions render as visual cards on the feature page, the same
way UX and UI decisions do. Every architecture decision in `decisions.json`
under `phases.architecture.decisions[]` has a sibling fragment file in
`features/{slug}/decisions/`. The fragment is produced by the build-decision
CLI; the orchestrator and architecture subagent never hand-author it.

### The `mc-arch-node` / `mc-diagram-surface` primitive

Architecture decisions render one card per option. Each card's visual is a
`mc-diagram-surface` containing a small node/edge schematic built from
`mc-arch-node` primitives. These live in
`control/layout/diagrams/architecture/template.html`. Shape:

```html
<div class="mc-diagram-surface">
  <div class="mc-arch-node mc-arch-client">Client</div>
  <div class="mc-arch-edge"></div>
  <div class="mc-arch-node mc-arch-service">Sync worker</div>
  <div class="mc-arch-edge"></div>
  <div class="mc-arch-node mc-arch-store">Storage</div>
</div>
```

`lib/v5/decision-visual-builder.mjs` selects the node/edge layout per option
based on keyword matching against the option string (sync vs. async,
direct vs. queued, single-service vs. fan-out). You do not assemble these
`<div>`s by hand — the CLI does it deterministically from the decision data.

### When to use architecture decisions

Use `category: 'engineering'` (sometimes `category: 'architecture'` in
older fixtures — both accepted) and the diagram-surface visual when the
choice is about *where code or data lives, how services connect, or which
storage / transport layer carries the data*. Examples:

- "How does the importer move files to storage?" — pick a transport.
- "Where does the parser run?" — pick a service.
- "How do we cache responses?" — pick a cache layout.

Do not use architecture decisions for user-journey ordering (UX) or for
surface placement (UI).

### Worked example

The decision in `decisions.json`:

```json
{
  "id": "arch-transport",
  "category": "engineering",
  "question": "How does the importer move file bytes from the browser into long-term storage?",
  "options": [
    "Direct browser → S3 pre-signed PUT",
    "Browser uploads to API, API streams to storage",
    "Browser uploads chunks to a queue, worker drains queue into storage"
  ],
  "selected": "Browser uploads chunks to a queue, worker drains queue into storage",
  "decidedAt": "..."
}
```

To produce the visual fragment:

```
node lib/v5/cli/build-decision.mjs <your-feature-slug> <your-decision-id>
```

The CLI writes `features/<your-feature-slug>/decisions/<your-decision-id>.html` —
a `mc-options-grid` fragment with one `mc-option-card` per option, each
carrying a `mc-diagram-surface` visual whose nodes and edges reflect the
transport (direct PUT vs. proxied stream vs. queue + worker).

You do not write that HTML. The CLI uses `lib/v5/decision-visual-builder.mjs`
and produces it deterministically from the decision data.

### Composing a feature-specific topology (v5.1)

The legacy rotation (`App → DB`, `Client → Service → Store`, ...) ignores
your actual stack. Use a sidecar JSON file to describe each option as the
real topology — your services, your transports, your stores.

**File path:** `control/v5/features/<slug>/decisions/<decision-id>.visual.json`

Three sources per option, tried in order: **`preset`** → **`diagram`** →
**`raw`** (see [ROUTING-MANIFEST.md](./ROUTING-MANIFEST.md#decisions-vs-clarifying-questions)).

#### Architecture preset catalog

| Preset | Topology |
|--------|----------|
| `client-server`    | Client → Service → DB |
| `crud-stack`       | Client → API → Store |
| `worker-queue`     | Client → API → Queue → Worker → Store |
| `pubsub`           | Publisher → Topic → Subscriber |
| `cdn-edge`         | Browser → CDN → Origin → Store |
| `microservices`    | Gateway → Service A → Service B → Store |
| `stream-pipeline`  | Source → Stream → Processor → Sink |
| `cache-aside`      | Client → Cache → Store |
| `read-replica`     | Client → API → Primary / Replica |
| `event-sourced`    | Client → Command → Event Log → Projection |
| `static-site`      | Build → Storage → CDN → Browser |
| `serverless`       | Trigger → Function → Storage |

#### Structured `diagram` shape for `category: "engineering"`

```json
{
  "nodes": [
    { "id": "browser", "kind": "client",  "label": "Browser" },
    { "id": "api",     "kind": "service", "label": "Import API" },
    { "id": "q",       "kind": "queue",   "label": "Upload jobs" },
    { "id": "worker",  "kind": "worker",  "label": "Chunk worker" },
    { "id": "store",   "kind": "db",      "label": "S3 bucket" }
  ],
  "edges": [
    { "from": "browser", "to": "api",    "kind": "sync",  "label": "POST" },
    { "from": "api",     "to": "q",      "kind": "async", "label": "enqueue" },
    { "from": "q",       "to": "worker", "kind": "async" },
    { "from": "worker",  "to": "store",  "kind": "data",  "label": "writes" }
  ]
}
```

Field rules:
- `nodes[].id` must be unique within the diagram (referenced by edges).
- `nodes[].kind` ∈ `"client" | "service" | "db" | "queue" | "cache" | "edge" | "worker" | "external" | "actor" | "function"`. Each kind has a visually distinct shape — pick the closest match.
- `edges[].kind` ∈ `"sync" | "async" | "data" | "dep"` (defaults to `"sync"`). `async` draws a dashed line, `data` is tinted green, `dep` is faint dots.
- The renderer orders nodes topologically (sources first, sinks last) and inserts one edge between each adjacent pair.

#### Worked example: feature-specific transport

`decisions/arch-transport.visual.json`:

```json
{
  "id": "arch-transport",
  "options": {
    "Direct browser → S3 pre-signed PUT": {
      "diagram": {
        "nodes": [
          { "id": "browser", "kind": "client",   "label": "Browser" },
          { "id": "api",     "kind": "service",  "label": "Signer" },
          { "id": "s3",      "kind": "external", "label": "S3" }
        ],
        "edges": [
          { "from": "browser", "to": "api", "kind": "sync", "label": "ask for URL" },
          { "from": "browser", "to": "s3",  "kind": "data", "label": "PUT" }
        ]
      }
    },
    "Browser uploads to API, API streams to storage": { "preset": "client-server" },
    "Browser uploads chunks to a queue, worker drains queue into storage": {
      "preset": "worker-queue"
    }
  }
}
```

Then run the CLI as before — it picks the sidecar up automatically.

### Where this fits alongside MVVM

`ARCHITECTURE-MVVM.md` governs the *code* inside a feature: how Model,
View, and ViewModel files relate. The fragments described here govern the
*decision page* for the feature: how each architectural choice is shown
to the user during the architecture phase. The two are orthogonal — every
feature has both an MVVM file layout *and* a set of decision fragments.

### The hard rule

> The visual fragment contract is auto-loaded into every dispatch packet — see [ROUTING-MANIFEST.md](./ROUTING-MANIFEST.md#visual-fragment-contract) for the canonical wording.
