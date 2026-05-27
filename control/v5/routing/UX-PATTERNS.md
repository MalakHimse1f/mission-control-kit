# UX Patterns

Operational guidance for v5 UX decisions: how the orchestrator and the
`ux-decisions` subagent encode user-flow choices, which diagram primitive
backs them, and the single rule about who writes the HTML.

## Purpose

This document is loaded into every dispatch packet whose `taskType` is
`ux-decisions`, `research`, or `brainstorm`. It tells the receiving subagent
two things:

1. What a UX decision *looks like* in `decisions.json` and on the feature
   page.
2. How to produce the visual fragment for that decision — the CLI is the
   only sanctioned author of decision card HTML.

## What a UX decision looks like

Every UX decision is a row in `decisions.json` under `phases.ux.decisions[]`.
The shape (see `lib/v5/decisions-schema.mjs`):

```json
{
  "id": "ux-source-picker-pattern",
  "category": "ux",
  "question": "How does the user pick which source to import from?",
  "options": ["…", "…", "…"],
  "selected": "…",
  "decidedAt": "2026-05-26T18:42:11.000Z"
}
```

The `id` is the canonical slug for the decision. It is also the basename of
the sibling fragment file: `decisions/ux-source-picker-pattern.html`.

## The `mc-flow-timeline` primitive

UX decisions render as one card per option. Each card's visual is a
horizontal `mc-flow-timeline` showing the user steps through that
interaction pattern. The primitive lives in
`control/layout/diagrams/ux-flow/template.html`. Shape:

```html
<div class="mc-flow-timeline">
  <div class="mc-flow-step">
    <div class="mc-flow-step-dot"></div>
    <div class="mc-flow-step-label">Pick source</div>
  </div>
  <div class="mc-flow-arrow"></div>
  <div class="mc-flow-step">…</div>
  …
</div>
```

`lib/v5/decision-visual-builder.mjs` knows how to translate an option
string into a 3–5 step timeline. You do not assemble these `<div>`s by
hand — the CLI does it deterministically from the decision data.

## When to use UX decisions

Use `category: 'ux'` (and the timeline visual) when the choice is about
*what the user does and in what order*. Examples:

- "How does the user pick which source to import from?" — pick a flow.
- "How does the user resolve a duplicate during import?" — pick a recovery
  flow.
- "How does onboarding sequence the steps?" — pick a journey.

Do not use UX decisions for component layout (that's UI — see
`UI-REQUIREMENTS.md`) or for service boundaries (that's Architecture —
see `ARCHITECTURE.md`).

## Worked example

The decision in `decisions.json`:

```json
{
  "id": "ux-source-picker-pattern",
  "category": "ux",
  "question": "How does the user pick which source to import from?",
  "options": [
    "Stepped wizard (pick source → authenticate/upload → review → confirm)",
    "Unified dropzone that auto-detects file type",
    "Flat source list with per-source CTA buttons"
  ],
  "selected": "Stepped wizard (pick source → authenticate/upload → review → confirm)",
  "decidedAt": "..."
}
```

To produce the visual fragment:

```
node lib/v5/cli/build-decision.mjs <your-feature-slug> <your-decision-id>
```

The CLI writes `features/<your-feature-slug>/decisions/<your-decision-id>.html` —
a `mc-options-grid` fragment with one `mc-option-card` per option, each
carrying a `mc-flow-timeline` visual.

You do not write that HTML. The CLI uses `lib/v5/decision-visual-builder.mjs`
and produces it deterministically from the decision data.

## Where this fits in the brainstorm flow

`mc-v5-brainstorm` runs `patternsToUxFlow(...)` to produce the overview
`features/{slug}/ux-flow.html` and *then* loops over each saved UX
decision and runs the CLI for each. The overview diagram lives at the
feature root; per-decision fragments live in `features/{slug}/decisions/`.

## Composing a feature-specific visual (v5.1)

Hardcoded presets don't fit every feature. Write a sidecar JSON file
alongside `decisions.json` to describe each option's visual in terms the
feature actually uses. The CLI reads it, validates it, and renders.

**File path:** `control/v5/features/<slug>/decisions/<decision-id>.visual.json`

Three sources per option, tried in order:

1. **`preset`** — named flow from the catalog below. Cheapest. Pick this
   when your option's flow is close to a generic pattern.
2. **`diagram`** — structured atoms. Use this when the flow is
   feature-specific. The agent describes step labels and kinds; never
   writes HTML.
3. **`raw`** — verbatim HTML. Escape hatch for unusual cases. Avoid unless
   the structured atoms can't represent your flow.

If a sidecar is missing or an option has no entry, the legacy rotation
fills in — so v5.0 decisions keep rendering unchanged.

### UX preset catalog

| Preset | Steps |
|--------|-------|
| `wizard-3step`     | Start → Configure → Confirm |
| `wizard-4step`     | Open → Configure → Submit → Done |
| `approval`         | Trigger → Review (decision) → Approve |
| `browse-select`    | Browse → Select → Detail → Apply |
| `onboarding`       | Welcome → Profile → Permissions → Done |
| `search-flow`      | Search → Filter → Result → Detail |
| `import-flow`      | Source → Map → Preview (decision) → Import |
| `share-flow`       | Pick → Compose → Send → Confirm |
| `signup`           | Form → Verify (decision) → Profile → Done |
| `signin`           | Credentials → 2FA (decision) → Home |
| `decision-tree`    | Question → Branch (decision) → Outcome |
| `error-recovery`   | Error → Diagnose (decision) → Retry → Success |

### Structured `diagram` shape for `category: "ux"`

```json
{
  "kind": "flow",
  "steps": [
    { "label": "Paste link",       "kind": "start"    },
    { "label": "Validate source",  "kind": "decision" },
    { "label": "Import",           "kind": "step"     },
    { "label": "Confirm",          "kind": "end"      }
  ],
  "swimlane": "user"
}
```

Field rules:
- `steps[].kind` ∈ `"start" | "step" | "decision" | "end"` (defaults to `"step"`)
- `steps[].label` is the visible text
- `steps[].icon` (optional) is one of `book | film | tv | game | music | user | users | search | settings | home | library | inbox | star | heart | tag | clock | lock | globe | plus | check | x | play | pause | download | upload | sync | edit | trash`
- `swimlane` (optional) ∈ `"user" | "system"` — left border tint

### Worked example: feature-specific import flow

`decisions/ux-import-source-picker.visual.json`:

```json
{
  "id": "ux-import-source-picker",
  "options": {
    "Stepped wizard (pick source → authenticate/upload → review → confirm)": {
      "diagram": {
        "kind": "flow",
        "steps": [
          { "label": "Pick source",    "kind": "start" },
          { "label": "Authenticate",   "kind": "step" },
          { "label": "Review",         "kind": "decision" },
          { "label": "Confirm",        "kind": "end" }
        ]
      }
    },
    "Unified dropzone that auto-detects file type": {
      "diagram": {
        "kind": "flow",
        "steps": [
          { "label": "Drop file",    "kind": "start", "icon": "upload" },
          { "label": "Detect type",  "kind": "decision" },
          { "label": "Map fields",   "kind": "step" },
          { "label": "Done",         "kind": "end",   "icon": "check" }
        ]
      }
    },
    "Flat source list with per-source CTA buttons": { "preset": "browse-select" }
  }
}
```

Then run the CLI as before — it picks the sidecar up automatically.

## The hard rule

> The visual fragment contract is auto-loaded into every dispatch packet — see [ROUTING-MANIFEST.md](./ROUTING-MANIFEST.md#visual-fragment-contract) for the canonical wording.
