# Layout primitives catalog

Structure and placement only. **Black / white / gray wireframes.** No fonts, radius, or brand colors.

**Which skeletons to use:** read `tech-stack/stack.json` → `layoutTargets` (set once at `/mc-init`). Do not ask the user for platform during `/mc-layout`. See [`../tech-stack/LAYOUT-TARGETS.md`](../tech-stack/LAYOUT-TARGETS.md).

Open [`index.html`](index.html) in a browser to preview all primitives.

## Skeletons (platform shells)

| ID | File | Use when |
|----|------|----------|
| `web-saas` | [`skeletons/web-saas.html`](skeletons/web-saas.html) | Logged-in web app, sidebar nav |
| `web-marketing` | [`skeletons/web-marketing.html`](skeletons/web-marketing.html) | Landing / marketing site |
| `desktop-mac` | [`skeletons/desktop-mac.html`](skeletons/desktop-mac.html) | macOS desktop app |
| `desktop-windows` | [`skeletons/desktop-windows.html`](skeletons/desktop-windows.html) | Windows desktop app |
| `ios-tab-nav` | [`skeletons/ios-tab-nav.html`](skeletons/ios-tab-nav.html) | iOS, bottom tabs |
| `ios-hamburger` | [`skeletons/ios-hamburger.html`](skeletons/ios-hamburger.html) | iOS, menu / drawer |
| `android-tab-nav` | [`skeletons/android-tab-nav.html`](skeletons/android-tab-nav.html) | Android, bottom tabs |
| `android-hamburger` | [`skeletons/android-hamburger.html`](skeletons/android-hamburger.html) | Android, drawer nav |

Stylesheet: [`wireframe.css`](wireframe.css)

## Primitives (compose inside skeleton regions)

| ID | Purpose |
|----|---------|
| `desktop-hero` | Large headline block, desktop width |
| `desktop-card` | Bordered content card, desktop |
| `mobile-hero` | Hero block, phone width |
| `mobile-card` | Card, phone width |
| `button` | Primary / secondary actions |
| `dropdown` | Select / menu trigger |
| `disclosure` | Expand/collapse section |
| `sheet-bottom` | Bottom sheet overlay |
| `sheet-left` | Left drawer / sheet |
| `sheet-right` | Right panel / sheet |
| `dialog` | Modal dialog |
| `text-field` | Single-line input |
| `table` | Tabular data |
| `list` | Vertical list rows |
| `gallery` | Image/media grid |
| `grid` | Generic content grid |

HTML snippets: [`primitives/`](primitives/) — one file per primitive.

## Agent rules

1. Pick skeleton(s) first — one per target platform.
2. Place primitives inside labeled regions — do not invent new chrome.
3. Document navigation paths in `features/{slug}/layout/layout.md`.
4. Output wireframes to `features/{slug}/layout/wireframes/{platform}.html`.
