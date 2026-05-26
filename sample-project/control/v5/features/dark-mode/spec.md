# Dark Mode — Spec

## Overview
System-respecting dark theme covering 100% of the web app, with a per-user override and no flash-of-wrong-theme on page load.

## Goals
- New users default to their OS preference (light or dark).
- Users can override and have the choice persist across devices.
- Zero flash-of-wrong-theme (FOWT) on first paint.
- All existing UI surfaces visually balanced in dark mode (contrast ≥ AA).

## Non-goals
- High-contrast accessibility theme (separate spec).
- Per-document or per-workspace theming.
- Custom user-defined accent colors.

## UX decisions (locked)
- Default: **follow system preference** (`prefers-color-scheme`).
- Toggle location: **account menu (gear icon)** with three options: Light / Dark / System.

## UI decisions (locked)
- Dark palette: **near-black neutral (#0a0a0a)** with soft borders.
- Accent: **slightly desaturated** version of the light-mode accent in dark mode.

## Architecture decisions (locked)
- Token delivery: **CSS variables on `:root`** with a `[data-theme="dark"]` attribute switch.
- Persistence: **localStorage + DB sync on auth** to carry preference across devices.

## Shipped
This feature is fully built and shipped. Marked complete on 2026-04-18.

## Success metrics (post-launch)
- 42% of users on dark mode within first month (target: 30%) ✅
- Zero FOWT reports in production ✅
- No regressions in contrast audits ✅
