# UX flow diagram primitive

Use this template to show a user journey as a horizontal step timeline
plus one or more **decision nodes** where the user picks between
branching paths. Decision nodes use list-style radio choices (not
illustrated cards — those live in `ui-options/` and `architecture/`).

## File

`template.html` — open it directly in a browser to QA. Self-contained,
links to `../_shared/diagram.css`, `diagram-select.js`,
`decisions-client.js`.

## Placeholders

| Token                                | Where                | Meaning                                                |
| ------------------------------------ | -------------------- | ------------------------------------------------------ |
| `{{TITLE}}`                          | `<title>` + heading  | "Team Collaboration — Real-time editing".              |
| `{{SUBTITLE}}`                       | Below title          | One-sentence framing.                                  |
| `{{SECTION_LABEL}}`                  | Small caps label     | e.g. "UX FLOW — REAL-TIME EDITING".                    |
| `{{STEP_N_ICON}}`                    | Step circle          | Emoji or short text (e.g. `📄`).                       |
| `{{STEP_N_LABEL}}`                   | Below step           | Step description (e.g. "User opens document").         |
| `{{DECISION_N_TITLE}}`               | Decision heading     | e.g. "Conflict Resolution".                            |
| `{{DECISION_N_CONTEXT}}`             | Decision sub-heading | Which step this branches from (e.g. "Step 4").         |
| `{{DECISION_N_GROUP_ID}}`            | `data-group=`        | Stable decision id, kebab-case.                        |
| `{{DECISION_N_OPTION_M_ID}}`         | `data-value=`        | Stable option id, kebab-case.                          |
| `{{DECISION_N_OPTION_M_LABEL}}`      | Radio label          | Display text.                                          |
| `{{SLUG}}`                           | Save script          | Feature slug for `/api/v5/decisions/{slug}` POST.      |
| `<!-- PLACEHOLDER:EXTRA_STEPS -->`   | Inside timeline      | Add more `.mc-flow-step` blocks.                       |
| `<!-- PLACEHOLDER:DECISION_2 -->`    | After 1st decision   | Add more `.mc-decision-node` blocks.                   |

## Data attribute contract

- `data-group="<group-id>"` on `.mc-radio-list` — required (one per
  decision node). Multiple decision nodes coexist on one page; each
  has its own group.
- `data-category="ux"` — optional hint.
- `data-value="<option-id>"` on each `.mc-radio-choice` — required.
- Mark one option `.selected` to pre-select a default.

## Selection ID convention

- Group IDs scoped to the flow: `conflict-resolution`,
  `cursor-visibility`, `onboarding-flow`.
- Option IDs are stable kebab-case slugs: `auto-merge`, `diff-popup`,
  `lock-section`.

## Save payload

`MCDiagramSelect.getSelections()` returns a flat map of every
`data-group` on the page:

```json
{
  "conflict-resolution": "auto-merge",
  "cursor-visibility": "show-cursors"
}
```

The inline `<script>` POSTs:

```json
{ "decisions": { "conflict-resolution": "auto-merge", ... } }
```

to `/api/v5/decisions/{slug}`. Task 6 will wrap this into the canonical
schema with category, question, and timestamp.
