# Selection UI — how to present choices visually

When you need the user to choose between options (UI, UX flow, or architecture),
do **not** dump text. Generate a self-contained HTML "decision deck" the user opens
in a browser, picks options, and copies their answers back to you.

## How to build one
1. Copy `template.html`. Fill in one `<section class="question">` per decision.
2. **Draw each option's mockup by hand** so it visibly shows what its text describes:
   - **UI** — a `.mf` device frame (app shell + real labels). See `example-ui.html`.
   - **UX flow** — `.flow` tiles (screens joined by `›` arrows). See `example-ux.html`.
   - **Architecture** — inline `<svg>` boxes/arrows/DB cylinders. See `example-engineer.html`.
3. Save next to the feature's other artifacts and tell the user the file path.

## Rules (non-negotiable)
- **Black / white / gray only.** Clean layout, strong typography, generous whitespace.
- **2–4 options** per question. Never 1. Never more than 4.
- **Every option's mockup must be visibly distinct and match its description.**
  If two options would look the same, the drawing is wrong — make the difference explicit.
- **You draw the mockups.** There is no component library or auto-builder. Riff on the examples.
- Keep the page **self-contained** (inline CSS/JS) so it works as a standalone file and embeds in the dashboard iframe.
- Pagination is optional; the answer dock is cumulative across all questions; the user pastes one block back to you.

## Anti-pattern (why this exists)
v5 auto-generated option pictures by keyword-matching the option text and drew
abstract placeholder bars. "Full-width form" vs "form in a modal" rendered
identically. Never reintroduce a keyword-matching diagram builder — the agent draws the real UI.
