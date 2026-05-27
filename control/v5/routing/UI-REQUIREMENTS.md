# UI Requirements

Operational guidance for v5 UI decisions: how the orchestrator and the
`ui-implementation` subagent encode component / surface / layout choices,
which diagram primitive backs them, and the single rule about who writes
the HTML.

## Purpose

This document is loaded into every dispatch packet whose `taskType` is
`ui-implementation`. It tells the receiving subagent two things:

1. What a UI decision *looks like* in `decisions.json` and on the feature
   page.
2. How to produce the visual fragment for that decision — the CLI is the
   only sanctioned author of decision card HTML.

UI decisions come *after* the UX phase has closed. The orchestrator should
never open a UI decision while `phases.ux.status !== 'complete'`.

## What a UI decision looks like

Every UI decision is a row in `decisions.json` under `phases.ui.decisions[]`.
The shape (see `lib/v5/decisions-schema.mjs`):

```json
{
  "id": "ui-surface-placement",
  "category": "ui",
  "question": "Where does the importer live in the app shell?",
  "options": ["…", "…", "…"],
  "selected": "…",
  "decidedAt": "2026-05-26T19:14:02.000Z"
}
```

The `id` doubles as the basename of the sibling fragment file:
`decisions/ui-surface-placement.html`.

## The `mc-mini-frame` primitive

UI decisions render as one card per option. Each card's visual is a small
schematic device mockup — a `mc-mini-frame` containing background lines
and a foreground element that distinguishes the option (full-page panel
vs. modal vs. inline drawer vs. tab). The primitive lives in
`control/layout/diagrams/ui-options/template.html`. Shape:

```html
<div class="mc-mini-frame">
  <div class="mc-mini-bg">
    <div class="mc-mini-bg-line title"></div>
    <div class="mc-mini-bg-line lg"></div>
    <div class="mc-mini-bg-line"></div>
  </div>
  <div class="mc-mini-fg">…option-specific element…</div>
</div>
```

`lib/v5/decision-visual-builder.mjs` chooses the foreground element per
option (dialog overlay, side drawer, full page, embedded tab) by
keyword-matching the option string. You do not assemble these `<div>`s by
hand — the CLI does it deterministically from the decision data.

## When to use UI decisions

Use `category: 'ui'` (and the mini-frame visual) when the choice is about
*where a surface lives, how it's anchored, or how it's laid out*. Examples:

- "Where does the importer live in the app shell?" — pick a placement.
- "How is the import progress surface presented?" — pick a panel shape.
- "How do we expose secondary actions on a card?" — pick a menu shape.

Do not use UI decisions for user-journey ordering (that's UX) or for
service boundaries (that's Architecture).

## Worked example

The decision in `decisions.json`:

```json
{
  "id": "ui-surface-placement",
  "category": "ui",
  "question": "Where does the importer live in the app shell?",
  "options": [
    "Full-page route under /library/import",
    "Modal dialog launched from the library header",
    "Side drawer that pins next to the library list"
  ],
  "selected": "Full-page route under /library/import",
  "decidedAt": "..."
}
```

To produce the visual fragment:

```
node lib/v5/cli/build-decision.mjs <your-feature-slug> <your-decision-id>
```

The CLI writes `features/<your-feature-slug>/decisions/<your-decision-id>.html` —
a `mc-options-grid` fragment with one `mc-option-card` per option, each
carrying a `mc-mini-frame` visual whose foreground reflects the placement
(full page, modal overlay, side drawer).

You do not write that HTML. The CLI uses `lib/v5/decision-visual-builder.mjs`
and produces it deterministically from the decision data.

## Wireframes are different

The optional `features/{slug}/layout/wireframes/` directory holds
*full-surface* wireframes — not decision cards. Wireframes are referenced
from the spec; decision fragments are referenced from the feature page's
Decisions section. Both can coexist. Neither is a substitute for the
other.

## Composing a feature-specific screen (v5.1)

The legacy `mc-mini-frame` rotation (dialog / drawer / sheet) can't show
a Library list or a search-results screen. Use a sidecar JSON file to
describe each option as a real screen mockup the user will recognize.

**File path:** `control/v5/features/<slug>/decisions/<decision-id>.visual.json`

Three sources per option, tried in order: **`preset`** → **`diagram`** →
**`raw`** (see [ROUTING-MANIFEST.md](./ROUTING-MANIFEST.md#decisions-vs-clarifying-questions)).

### UI preset catalog

| Preset | Shape |
|--------|-------|
| `list-detail`      | Phone, header + list body |
| `grid-gallery`     | Phone, header + 3-col grid |
| `form-screen`      | Phone, header + form + Save button |
| `dashboard`        | Desktop, header nav + 3-col grid |
| `settings`         | Phone, header + toggle/select list |
| `search-results`   | Phone, search header + result list |
| `dialog-confirm`   | Modal, hero icon + Cancel/Confirm buttons |
| `bottom-sheet`     | Phone, sheet-style list |
| `side-drawer`      | Phone, nav drawer + tab bar |
| `empty-state`      | Phone, empty placeholder |
| `loading-state`    | Phone, skeleton lines |
| `hero-cta`         | Phone, hero + primary CTA |

### Structured `diagram` shape for `category: "ui"`

```json
{
  "frame": "phone",
  "header": { "title": "Library", "back": true, "actions": ["search"] },
  "body": [
    { "kind": "list", "items": [
      { "icon": "book", "title": "1984", "subtitle": "Orwell" },
      { "icon": "film", "title": "Blade Runner", "subtitle": "1982" }
    ]}
  ],
  "footer": { "kind": "tab-bar", "items": ["Home","Library","Me"] }
}
```

Field rules:
- `frame` ∈ `"phone" | "desktop" | "modal" | "card"` (defaults to `"phone"`)
- `header.actions[]` are icon names (same vocabulary as UX `steps[].icon`)
- `body[]` is an ordered list of body elements; each `{ kind, ... }` is one of:
  - `{ "kind": "list",    "items": [{ icon?, title, subtitle? }, ...] }`
  - `{ "kind": "grid",    "items": [{ icon?, label }, ...], "cols"?: 2|3 }`
  - `{ "kind": "form",    "fields": [{ "kind": "text"|"select"|"toggle", "label" }, ...] }`
  - `{ "kind": "hero",    "title", "subtitle"?, "icon"? }`
  - `{ "kind": "text",    "lines": number }`
  - `{ "kind": "buttons", "items": [{ "label", "primary"? }, ...] }`
  - `{ "kind": "empty",   "label"? }`
- `footer.kind` ∈ `"tab-bar" | "action-bar"`

### Worked example: feature-specific UI placement

`decisions/ui-surface-placement.visual.json`:

```json
{
  "id": "ui-surface-placement",
  "options": {
    "Full-page route under /library/import": {
      "diagram": {
        "frame": "phone",
        "header": { "title": "Import library", "back": true },
        "body": [
          { "kind": "form", "fields": [
            { "kind": "select", "label": "Source" },
            { "kind": "text",   "label": "Account email" }
          ]},
          { "kind": "buttons", "items": [{ "label": "Continue", "primary": true }] }
        ]
      }
    },
    "Modal dialog launched from the library header": { "preset": "dialog-confirm" },
    "Side drawer that pins next to the library list": { "preset": "side-drawer" }
  }
}
```

Then run the CLI as before — it picks the sidecar up automatically.

## The hard rule

> The visual fragment contract is auto-loaded into every dispatch packet — see [ROUTING-MANIFEST.md](./ROUTING-MANIFEST.md#visual-fragment-contract) for the canonical wording.
