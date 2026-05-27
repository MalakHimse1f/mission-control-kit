# Architecture diagram primitive

Use this template to render a single architecture decision: 2–4 cards,
each showing an SVG/DIV architecture diagram, a label, and a short
description. Cards behave as a radio group — clicking one selects it
and de-selects siblings.

## File

`template.html` — open it directly in a browser to QA. It is fully
self-contained (links to `../_shared/diagram.css`, `diagram-select.js`,
`decisions-client.js`).

## Placeholders

Two flavors. Pick whichever fits your substitution tool:

| Token                          | Where               | Meaning                                                       |
| ------------------------------ | ------------------- | ------------------------------------------------------------- |
| `{{TITLE}}`                    | `<title>` + heading | Page/diagram title (e.g. "Data Architecture").                |
| `{{SUBTITLE}}`                 | Below title         | One-sentence framing.                                         |
| `{{SECTION_LABEL}}`            | Small caps label    | e.g. "ENGINEERING DECISION — DATA ARCHITECTURE".              |
| `{{GROUP_ID}}`                 | `data-group=`       | Stable decision id, kebab-case (e.g. `data-architecture`).    |
| `{{QUESTION}}`                 | `data-question=`    | Human-readable question (optional, used for hydration).       |
| `{{OPTION_N_ID}}`              | `data-value=`       | Stable option id, kebab-case (e.g. `monolith-sql`).           |
| `{{OPTION_N_LABEL}}`           | Card heading        | Display name (e.g. "Monolith + SQL").                         |
| `{{OPTION_N_DESC}}`            | Below label         | One-line description.                                         |
| `{{OPTION_N_TOOLTIP}}`         | Hover tooltip       | Longer rationale shown on hover.                              |
| `{{SLUG}}`                     | Save script         | Feature slug used for the `/api/v5/decisions/{slug}` POST.    |
| `<!-- PLACEHOLDER:OPTION_N_DIAGRAM -->` | Inside a card | Replace the dummy SVG/DIV with your own architecture diagram. |
| `<!-- PLACEHOLDER:OPTION_4 -->` | After option 3      | Drop in a 4th card (and switch grid to `data-cols="4"`).      |

## Data attribute contract

- `data-group="<group-id>"` on `.mc-options-grid` — required.
- `data-category="engineering"` — optional category hint.
- `data-value="<option-id>"` on each `.mc-option-card` — required.
- The first card may keep the `.selected` class as a default.

## Selection ID convention

- Group IDs: kebab-case, scoped to the feature (e.g. `data-architecture`,
  `auth-strategy`, `realtime-sync`).
- Option IDs: kebab-case, globally meaningful for the group
  (e.g. `monolith-sql`, `microservices-bus`, `serverless-nosql`).

## Save payload

When the user clicks Save, `MCDiagramSelect.getSelections()` returns:

```json
{ "data-architecture": "monolith-sql" }
```

The template's inline `<script>` wraps that into a minimal payload and
POSTs it to `/api/v5/decisions/{slug}`:

```json
{ "decisions": { "data-architecture": "monolith-sql" } }
```

Task 6's feature page wraps multiple diagram groups into the canonical
schema before calling `MCDecisions.save(slug, …)`.
