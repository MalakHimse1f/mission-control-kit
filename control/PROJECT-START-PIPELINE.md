# Project START pipeline — Mission Control v4

Use when starting a **new product** or **new app foundation** — not when adding a feature to an existing product.

**Command:** `/mc-start <product idea>`

**Required bundle:** [startup-skill](https://github.com/ferdinandobons/startup-skill) — see `SKILL-DEPENDENCIES.md`.

---

## Purpose

Answer before any feature-level PRD work:

- Is this worth building?
- Who is it for? What is the market?
- Who are competitors? How do we position?
- Which platforms (web, iOS, Android, marketing site)?
- What tech stack supports those platforms?
- What is the initial feature portfolio and build order?
- What launch instrumentation is needed (analytics, feedback, waitlist)?

---

## Pipeline stages

| Step | ID | Orchestrator | Skills / agents | Disk output |
|------|-----|--------------|-----------------|-------------|
| 0 | `vendor-setup` | Verify startup-skill installed | `mc-setup-skills` if missing | journal vendor-setup |
| 1 | `braindump` | Capture product idea | — | `project/PROJECT.md`, `project/status.json` |
| 2 | `validate` | Run startup validation | **`startup-design`** (required) | `project/market-brief.md`, journal |
| 3 | `compete` | Competitive landscape | **`startup-competitors`** when needed | `project/competitors.md`, journal |
| 4 | `position` | Positioning | **`startup-positioning`** (required) | `project/positioning.md`, journal |
| 5 | `platforms` | Platform targets | orchestrator + AskQuestion | `project/platform-matrix.md` |
| 6 | `stack` | Tech stack | `/mc-init` or stack scout subagent | `tech-stack/stack.json`, `CONTEXT.md` |
| 7 | `portfolio` | Seed feature slugs | `/mc-portfolio` when 2+ features | `state.json` buildOrder, SPEC-PORTFOLIO-REVIEW |
| 8 | `launch-prep` | GTM / instrumentation checklist | optional **`startup-pitch`** | `project/launch-checklist.md` |
| 9 | `done` | Hand off to Add Feature | — | `workflowType` → add-feature for first slug |

Set `state.json`:

```json
{
  "workflowType": "project-start",
  "projectStartStage": "validate",
  "techStackStatus": null
}
```

After `done`, user runs `/mc-feature {first-slug}` for each capability.

---

## Context routing (Project START)

| Stage | Read | Skip |
|-------|------|------|
| validate | PROJECT.md only | features/*, codebases |
| compete | PROJECT.md, market-brief | feature specs |
| position | market-brief, competitors | implementation plans |
| platforms | positioning, market-brief | mock HTML, phase plans |
| stack | platform-matrix, positioning | unrelated repos |

---

## Launch checklist (from product ops)

Include in `project/launch-checklist.md`:

- Waitlist / beta signup
- Analytics (e.g. PostHog)
- Feedback board (e.g. Canny)
- Email sequences
- App store / landing page (when shipping native or public web)

---

## Exit criteria

Project START is **done** when:

1. Go/no-go documented in market-brief
2. Positioning doc approved
3. Platform matrix locked
4. `tech-stack/stack.json` established
5. Initial UX feature slugs scaffolded under `features/` with braindump stubs
6. Launch checklist drafted (even if many items TBD)
