# Workstreams: Tech stack vs features

Mission Control tracks two kinds of work. Agents **must** classify every braindump into one bucket before writing files.

## Tech stack (`tech-stack/{slug}/`)

**App setup and configuration** — things that must exist before or alongside UX work, but users do not interact with directly.

Examples:

- Scaffold Next.js / React Native / Swift iOS app
- Configure Supabase, database migrations, env templates
- Set up CI, deployment, monorepo structure
- Install shared tooling (lint, test runner, design system package)

**Pipeline:** spec → plan → build ( **no layout** )

## Features (`features/{slug}/`)

**End-user experience** — screens, flows, and behaviors users see and use.

Examples:

- Sign up, sign in, password reset
- Home dashboard, settings, checkout
- Calculator UI, video export flow

**Pipeline:** spec → layout → plan → build

## How to classify

| Signal | Workstream |
|--------|------------|
| "Scaffold", "configure", "set up project", "install framework" | Tech stack |
| "Users can", "screen", "flow", "button", "page" | Feature |
| Ambiguous | Ask via structured ask tool (see `USER-QUESTIONS.md`) |

**Never** put scaffolding in `features/` or user flows in `tech-stack/` without user confirmation.

## Platforms — asked once at `/mc-init` only

Surfaces (web, iOS, Android, desktop) are stored in `tech-stack/stack.json` → **`layoutTargets[]`**.

| Stage | Platform behavior |
|-------|-------------------|
| `/mc-init` | Ask or confirm layout targets **once** |
| `/mc-layout`, `/mc-braindump`, `/mc-plan`, `/mc-build` | **Read stack.json — never ask** |

See `tech-stack/LAYOUT-TARGETS.md`. If `layoutTargets` is empty, send user to `/mc-init`.

## Project entry

| Situation | First command |
|-----------|---------------|
| Mission Control freshly installed, or `stack.json` → `techStackStatus` is null | **`/mc-init`** |
| Existing codebase | `/mc-init` detects stack from repo, user confirms |
| Greenfield | `/mc-init` asks UX feature names, then tech stack, scaffolds draft specs |
| Stack established | `/mc-braindump` for new tech or UX items |

## State fields (`state.json`)

| Field | Values |
|-------|--------|
| `projectMode` | `"existing"` \| `"greenfield"` |
| `techStackStatus` | `"established"` when `/mc-init` completes |
| `activeWorkstream` | `"tech-stack"` \| `"feature"` during build |
| `activeTechSlug` | Current tech item |
| `activeFeature` | Current UX feature |
| `techStackOrder` | Build order for tech items |
| `buildOrder` | Build order for UX features |

## Dashboard

- **Tech stack** section — context + setup items + tasks
- **Features** section — user-facing portfolio + tasks

Both sections are additive; see `AGENT-DATA-RULES.md`.
