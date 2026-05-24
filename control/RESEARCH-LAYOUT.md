# Research HTML layouts

Vendor skill and explore outputs must be **HTML pages** composed from Mission Control layout primitives — not raw markdown in chat or `<pre>` blocks on the dashboard.

**Stylesheet:** `layout/wireframe.css` (inlined automatically when the dashboard embeds pages in iframes).

**Builder library:** `control/lib/research-layout.mjs`  
**Preview primitives:** `layout/primitives/index.html`

---

## Required disk outputs

| Stage | Skill / agent | Primary output | Legacy fallback |
|-------|---------------|----------------|-----------------|
| explore | `mc-explore` | `features/{slug}/explore/{label}.html` | `{label}.md` |
| research | `design-research` | `features/{slug}/research.html` | `research.md` |
| strategy | `ux-strategy` | `features/{slug}/ux-strategy.html` | `ux-strategy.md` |
| interaction | `interaction-design` | `features/{slug}/interaction.html` | `interaction.md` |

Markdown fallbacks are auto-converted for dashboard display but **new work must write `.html`**.

---

## Page structure

Every research HTML file must be a full document:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>UX Research — {feature slug}</title>
  <link rel="stylesheet" href="../../layout/wireframe.css" />
</head>
<body>
<div class="wf-page wf-desktop">
  <section class="wf-hero">…</section>
  <div style="padding:24px">
    <!-- primitive sections -->
  </div>
</div>
</body>
</html>
```

For feature-root files (`research.html`), CSS path is `../layout/wireframe.css`.  
For explore files, use `../../../layout/wireframe.css`.

Or use `buildResearchPage()` from `research-layout.mjs` — CSS is inlined at dashboard embed time.

---

## Primitive mapping

| Finding type | Primitives |
|--------------|------------|
| Personas | `desktop-card` or `mobile-card` in a `grid` |
| Journey / flow steps | `list` |
| IA / sitemap | `disclosure` (nested) + `list` |
| Interview synthesis | `table` |
| Competitive comparison | `table` or `grid` of cards |
| Key insights | `desktop-card` with `wf-label` |
| Screen/state notes | `disclosure` |

Copy HTML from `layout/primitives/{id}.html` — do not invent new chrome. Wrap sections in `wf-region` with a `wf-label`.

---

## Section helpers (optional)

```javascript
import {
  buildResearchPage,
  cardSection,
  listSection,
  tableSection,
  gridSection,
  heroSection,
  readWireframeCss,
} from '../lib/research-layout.mjs';
```

Agents may compose HTML manually or via these helpers in journal/build scripts.

---

## Dashboard

Research and explore HTML appear in the feature detail modal as **live iframe layouts** (same pattern as UI wireframes), not monospace markdown.

Regenerate after writes: `node docs/superpowers/control/scripts/generate-dashboard.mjs`

---

## Rules

1. **Never** leave research decisions only in chat — write HTML to disk.
2. Use **black / white / gray** wireframe styling only (no brand colors).
3. One topic per section — cards, lists, and tables over long prose.
4. Explore subagents: see `features/_template/explore/_example.html`.
