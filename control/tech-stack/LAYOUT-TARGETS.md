# Layout targets (platforms)

**Platforms are chosen exactly once** — during `/mc-init`. They are stored in `tech-stack/stack.json` → `layoutTargets[]`.

All later stages (`/mc-layout`, `/mc-braindump`, `/mc-plan`, `/mc-build`) **read** this list. **Never ask the user which platform again.**

## `layoutTargets` values

These IDs correspond to platform targets for wireframes built from `control/layout/selection/template.html` (see `SELECTION-UI.md`):

| ID | User-facing label (use in `/mc-init` ask tool) |
|----|------------------------------------------------|
| `web-saas` | Web app — signed-in product (tabs/sidebar) |
| `web-marketing` | Web — marketing or landing site |
| `desktop-mac` | Desktop — Mac |
| `desktop-windows` | Desktop — Windows |
| `ios-tab-nav` | iPhone / iPad — bottom tabs |
| `ios-hamburger` | iPhone / iPad — menu drawer |
| `android-tab-nav` | Android — bottom tabs |
| `android-hamburger` | Android — menu drawer |

`/mc-init` must persist the chosen IDs to `stack.json` → `layoutTargets`.

## Inferring from repo (existing projects)

When `detect-stack.mjs` finds:

| Detection | Default `layoutTargets` |
|-----------|-------------------------|
| Next.js / React web | `web-saas` |
| Marketing-only Next site | `web-marketing` |
| Electron | `desktop-mac` or `desktop-windows` (ask once at init if unclear) |
| iOS (`ios/` or `.xcodeproj`) | `ios-tab-nav` unless init says otherwise |
| Android (`android/`) | `android-tab-nav` unless init says otherwise |

Agent confirms inferred targets **only at `/mc-init`**, not during feature work.

## At `/mc-layout`

1. Read `tech-stack/stack.json` → `layoutTargets` (required).
2. Copy into `features/{slug}/layout/platforms.json`:

```json
{
  "scope": "new-feature",
  "layoutTargets": ["web-saas"],
  "fromStack": true
}
```

3. Build one wireframe per entry in `layoutTargets`.
4. Ask about **this feature only:** screens, navigation, primary user path — **not** platform.

If `layoutTargets` is empty and `techStackStatus` is `"established"`, tell the user to re-run `/mc-init` to add platforms — do not ask in layout.
