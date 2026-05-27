# UI options diagram primitive

Use this template to compare side-by-side UI patterns: dialog vs drawer
vs bottom sheet, tab bar vs hamburger vs sidebar, list vs grid vs
gallery, etc. Each option card holds a tiny mockup made of basic divs
(no images), wrapped in `.mc-mini-frame`.

## File

`template.html` — open it directly in a browser to QA. Self-contained,
links to `../_shared/diagram.css`, `diagram-select.js`,
`decisions-client.js`.

## Placeholders

| Token                                | Where               | Meaning                                                      |
| ------------------------------------ | ------------------- | ------------------------------------------------------------ |
| `{{TITLE}}`                          | `<title>` + heading | "Navigation Pattern", "Add-to-cart UI", …                    |
| `{{SUBTITLE}}`                       | Below title         | One-sentence framing.                                        |
| `{{SECTION_LABEL}}`                  | Small caps label    | e.g. "UI DECISION — NAVIGATION PATTERN".                     |
| `{{GROUP_ID}}`                       | `data-group=`       | Stable decision id, kebab-case (`navigation-pattern`).       |
| `{{QUESTION}}`                       | `data-question=`    | Optional human-readable question.                            |
| `{{OPTION_N_ID}}`                    | `data-value=`       | Stable option id (e.g. `tab-bar`, `dialog`).                 |
| `{{OPTION_N_LABEL}}`                 | Card heading        | Display name ("Tab Bar").                                    |
| `{{OPTION_N_DESC}}`                  | Below label         | One-line description.                                        |
| `{{OPTION_N_TOOLTIP}}`               | Hover tooltip       | Longer rationale.                                            |
| `{{SLUG}}`                           | Save script         | Feature slug for `/api/v5/decisions/{slug}` POST.            |
| `<!-- PLACEHOLDER:OPTION_N_MOCKUP -->` | Inside a card     | Replace the default mini-frame with a custom mockup.         |
| `<!-- PLACEHOLDER:OPTION_4 -->`      | After option 3      | Drop in a 4th card and switch grid to `data-cols="4"`.       |

## Mini-frame helpers

The shared CSS ships ready-made primitives so subagents rarely need to
write fresh markup:

- `.mc-mini-frame` — phone/window outer surface.
- `.mc-mini-bg` + `.mc-mini-bg-line.title|lg|md|sm` — placeholder content
  lines behind the surface.
- `.mc-mini-dialog` — centered dialog with action buttons.
- `.mc-mini-drawer` — right-side drawer menu.
- `.mc-mini-sheet` — bottom sheet with handle and list items.
- `.mc-mini-scrim` — semi-opaque overlay for modal patterns.

Compose these freely — every option can use different ones.

## Data attribute contract

- `data-group="<group-id>"` on `.mc-options-grid` — required.
- `data-category="ui"` — optional.
- `data-value="<option-id>"` on each `.mc-option-card` — required.
- Pre-select a default by adding `.selected` to one card.

## Save payload

`MCDiagramSelect.getSelections()` returns:

```json
{ "navigation-pattern": "tab-bar" }
```

POSTed as:

```json
{ "decisions": { "navigation-pattern": "tab-bar" } }
```

to `/api/v5/decisions/{slug}`. Task 6 wraps multiple groups into the
canonical decisions schema (with category, question, timestamp).
