---
name: mc-v5-decide
description: "Mission Control v5 — Canonical decision-encoding flow. Prompt the user for a decision, write it to decisions.json (atomic), generate the visual fragment via lib/v5/cli/build-decision.mjs, and surface the result by opening the dashboard. Usage: orchestrator invokes whenever a UX / UI / architecture decision needs to be captured."
when: "Use whenever a v5 feature needs to encode a single decision (a question, 3-4 options, and a selected option) into decisions.json and produce its visual fragment. This is the *only* sanctioned flow for capturing decisions; do not write decisions.json or fragment HTML from anywhere else."
---

# Mission Control v5 — Decision encoding flow

**You are the v5 decision-encoder.** This skill is the canonical path for
turning a user choice into a saved decision *and* a visual fragment. The
orchestrator dispatches it whenever a UX, UI, or architecture decision is
ready to be locked in.

## Visual rules

> Visual fragment contract: see `control/v5/routing/ROUTING-MANIFEST.md`. The rule is auto-injected into every dispatch packet via the router's `usageNote`.

## Canonical sequence (do NOT reorder)

1. **Gather the decision inputs from the user.**
   - The **question** (one sentence; phrased from the user's perspective).
   - The **options** (3–4 strings; each phrased as a complete answer).
   - The **selected** option (must be one of the options verbatim).
   - A short, kebab-cased **id** (e.g., `ux-source-picker-pattern`).
2. **Determine `category`** from context:
   - `ux` — user-journey ordering, flow choices. Renders with
     `mc-flow-timeline`. See `control/v5/routing/UX-PATTERNS.md`.
   - `ui` — surface placement, component shape. Renders with
     `mc-mini-frame`. See `control/v5/routing/UI-REQUIREMENTS.md`.
   - `engineering` — service / transport / storage choices. Renders with
     `mc-arch-node` / `mc-diagram-surface`. See
     `control/v5/routing/ARCHITECTURE.md`.
3. **Write the decision into `decisions.json`** via `writeDecisions(slug,
   payload, { controlRoot })` in `lib/v5/decisions.mjs`. The helper is
   atomic (tmp + rename) and validates against the schema. Read first,
   append the new decision to the right `phases.<category>.decisions[]`,
   then write.
4. **Generate the visual fragment.** Run from the project root:

   ```bash
   node lib/v5/cli/build-decision.mjs <slug> <decision-id>
   ```

   The CLI writes
   `control/v5/features/<slug>/decisions/<decision-id>.html`. Do NOT
   write that file by hand.
5. **Open the dashboard** to surface the result. Call
   `openDashboard({ slug, anchor: 'decisions', controlRoot })` from
   `lib/v5/auto-launch.mjs`. It ensures the v5 server is running, opens
   the user's default browser, and returns the URL.
6. **Tell the user.** Say verbatim (substituting the URL):
   > I've saved the decision and opened the dashboard at: {url}

## Concrete one-liner

Run from the project root after the decision has been written to disk:

```bash
node lib/v5/cli/build-decision.mjs '{slug}' '{decision-id}'
```

## Inputs

- `slug` — feature slug. Required.
- `question`, `options[]`, `selected`, `id`, `category` — gathered in
  step 1 of the canonical sequence.
- `controlRoot` — project root containing `control/v5/`. Resolved from
  cwd if omitted.

## Outputs

- A new row in
  `control/v5/features/{slug}/decisions.json` under
  `phases.<category>.decisions[]`.
- A new fragment file at
  `control/v5/features/{slug}/decisions/{id}.html`.
- A dashboard URL opened in the user's default browser.

## Parallelism

Multiple decisions can be encoded in parallel **only when each touches a
different fragment file** (i.e., different `id`s). Since the CLI writes
one file per id, parallel dispatch is safe. See
`skills/mc-v5/parallel-execution.md` for the orchestrator's parallel
dispatch rules.

Note: `writeDecisions` reads-modifies-writes `decisions.json`, so two
concurrent calls *to the same slug* can race. If you need to encode
multiple decisions for the same slug in one batch, either:

- Sequence the `writeDecisions` calls, or
- Read once, append all new decisions in memory, write once, then run
  the CLI for each id in parallel.

## Boundaries

- Do NOT write `decisions/{id}.html` by hand. The CLI is the only
  sanctioned author.
- Do NOT skip the `openDashboard` step. The user must be able to verify
  the visual landed correctly; chat output is not a substitute.
- Do NOT invent new categories. The three categories above are the only
  shapes the visual builder knows how to render.
- Do NOT modify `lib/v5/decision-visual-builder.mjs` from this skill —
  it is a stable seam.

## Never

- Dispatch this skill without a complete decision (id, question, 3–4
  options, selected, category).
- Write the fragment HTML before the CLI exists or before
  `decisions.json` has the row. The CLI reads from `decisions.json` and
  will fail loudly if the id is missing.
- Skip the verbatim user-facing message in step 6 — the URL is the only
  way the user discovers the new visual.
