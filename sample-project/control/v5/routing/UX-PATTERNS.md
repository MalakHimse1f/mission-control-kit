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

## Patterns the orchestrator should reach for

| Situation | Pattern | Visual |
|-----------|---------|--------|
| User picks one of several flows | flow-per-option grid | `mc-flow-timeline` |
| User confirms a destructive action | dialog-with-preview | `mc-mini-frame` + flow step |
| Multi-step onboarding | sequenced steps | `mc-flow-timeline` with progress dots |
| Error recovery | conditional branch | `mc-flow-timeline` with a fork node |

Each of these is encoded by `decision-visual-builder.mjs`. The orchestrator
selects the right shape implicitly by setting `category: 'ux'`; the CLI
chooses the per-option timeline structure.

## The hard rule

> The visual fragment contract is auto-loaded into every dispatch packet — see [ROUTING-MANIFEST.md](./ROUTING-MANIFEST.md#visual-fragment-contract) for the canonical wording.
