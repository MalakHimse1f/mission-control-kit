# Safe upgrade mechanism

**Slug:** `safe-upgrade`
**Date:** 2026-05-24

## Idea

Publish Mission Control Kit v4 as a tool others can install. Users need a **programmatic upgrade path** that refreshes kit runtime (orchestrator docs, skills, scripts) without overwriting their specs, features, journals, or project state.

## Target codebase

- `mission-control-kit-v4/` (this repo — kit source and dogfood target)
- Installed projects: `docs/superpowers/control/` + `.claude/skills/` + kit folder in project root

## Requirements (from product discussion)

1. Built-in update mechanism — `mc upgrade` / `/mc-upgrade`
2. User files, specs, features never overwritten
3. Programmatic, testable (TDD)
4. Non-dev friendly: dashboard update notice, chat command, installer "Update" mode
5. Version stamp + migration hook for future schema changes
6. Dry-run and backup before apply

## Tech-stack path

Skip mock/interaction — infrastructure feature, no UI mock beyond dashboard version strip.

## Out of scope (v1)

- Download from GitHub releases (local kit folder only)
- Electron desktop app
- `_kit/` vs `custom/` split (use preserve globs first)
