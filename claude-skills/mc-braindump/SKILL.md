---
name: mc-braindump
description: "Mission Control brainstorming — always offer research, convert returned patterns into a UX flow diagram, save to features/{slug}/ux-flow.html, auto-launch the dashboard. Usage: /mc-braindump"
when: "Use during the brainstorm/braindump stage of a v5 feature — after the user has described what they want and before any spec, PRD, or implementation work begins. Canonical patterns reference: control/v5/routing/UX-PATTERNS.md."
---

# Mission Control — Brainstorming flow (research → diagram)

**You are the v5 brainstorming flow.** This skill encodes the canonical
sequence for turning a feature idea into a UX flow diagram and opening it
in the dashboard. It runs after the user has described what they want and
before any PRD or mock work.

## Canonical sequence (do NOT reorder)

1. **Scaffold the feature folder if it does not exist yet.** Derive a
   kebab-case slug from the user's idea and check whether
   `control/v5/features/{slug}/` exists. If it does not, run:
   ```bash
   node lib/v5/cli/new-feature.mjs {slug} --description "{one-line idea}"
   ```
   Then continue with the steps below.
2. **Scope.** Ask one scoping question (target user, primary trigger, key
   constraints — pick the one most likely to unlock everything else).
3. **User responds. Persist the idea + scope to disk.** Write the user's
   original idea and scoping answer to
   `control/v5/features/{slug}/braindump.md` (create it if missing). This is
   the brainstorm stage's required artifact — downstream stages (`mc-prd`, the
   `research`/`brainstorm` routes) read `braindump.md` for the original intent,
   so it must exist before any UX-flow work.
4. **Always offer research.** MUST ask: *"Want me to research
   {feature-type} patterns?"* — this offer is not optional and not
   conditional on heuristics. Phrasing:
   > Want me to research [notification / onboarding / settings UI / …]
   > patterns?
5. **If yes →** dispatch the `parallel-web-search` skill (or
   `parallel-deep-research` if the user explicitly asked for "deep"
   research). That skill is provided by the superpowers/vendor bundle —
   do NOT implement search here. Pass it the feature scope from step 3.
6. **Research subagent returns patterns** as an array of objects with at
   least `{ name, description }` and optionally `{ pros, cons }`. Typical
   research returns 3–5 patterns.
7. **Transform patterns → UX flow diagram.** Call
   `patternsToUxFlow(patterns, { slug })` from
   `lib/v5/pattern-to-diagram.mjs`. It returns a complete standalone HTML
   string built on the `control/layout/diagrams/ux-flow/template.html`
   primitive. Each pattern becomes one selectable `.mc-radio-choice` so
   `diagram-select.js` recognises it on save.
8. **Write the HTML** to `control/v5/features/{slug}/ux-flow.html`
   (create the parent directory if missing).
9. **Generate visual fragments for every saved decision.** Read
   `control/v5/features/{slug}/decisions.json` and iterate every
   `decision.id` across `phases.ux.decisions[]`,
   `phases.ui.decisions[]`, and `phases.architecture.decisions[]`. For
   each id, shell out to
   `node lib/v5/cli/build-decision.mjs <slug> <decision-id>`. The CLI
   writes `features/{slug}/decisions/<decision-id>.html`. Do **NOT**
   author these fragments by hand — see "Visual rules" below.
10. **Auto-launch the dashboard.** Call `openDashboard({ slug, anchor:
    'decisions', controlRoot })` from `lib/v5/auto-launch.mjs`.
    It ensures the v5 server is running, opens the user's browser, and
    resolves the URL.
11. **Tell the user.** Say verbatim (substituting the URL):
    > I've opened the dashboard for you to review the UX flow at: {url}

If research is declined at step 4, skip steps 5–10 and proceed to scoping
follow-ups. The offer in step 4 is still mandatory — declining is the
user's call, not the orchestrator's.

## Visual rules

> Visual fragment contract: see `control/v5/routing/ROUTING-MANIFEST.md`. The rule is auto-injected into every dispatch packet via the router's `usageNote`.

The brainstorm skill produces two kinds of HTML:

- **The overview UX flow** at `features/{slug}/ux-flow.html` — produced
  by `patternsToUxFlow(...)` in `lib/v5/pattern-to-diagram.mjs`. This is
  the only HTML this skill is allowed to write directly.
- **Per-decision fragments** in `features/{slug}/decisions/` — produced
  by the `build-decision.mjs` CLI in step 9. Do **NOT** author these by
  hand under any circumstances. If the CLI is missing or fails, stop
  and surface the error; do not improvise.

If multiple decisions need fragments, they may be generated in parallel
since each touches a different fragment file (see
`skills/mc/parallel-execution.md` for parallelism rules).

## Concrete one-liners

Run these from the repo root. Substitute `{slug}` and `{patterns-json}`.

Generate the diagram HTML (after research returns patterns):

```bash
node -e "
import('./lib/v5/pattern-to-diagram.mjs').then(async ({ patternsToUxFlow }) => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const patterns = JSON.parse(process.argv[1]);
  const slug = process.argv[2];
  const out = path.join('control/v5/features', slug, 'ux-flow.html');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, patternsToUxFlow(patterns, { slug }), 'utf8');
  console.log('wrote', out);
});
" '{patterns-json}' '{slug}'
```

Auto-launch the dashboard (after writing the HTML):

```bash
node -e "
import('./lib/v5/auto-launch.mjs').then(async ({ openDashboard }) => {
  const { url } = await openDashboard({
    slug: process.argv[1],
    anchor: 'decisions',
    // controlRoot is the project root (directory containing control/v5/)
    controlRoot: process.cwd(),
  });
  console.log(url);
});
" '{slug}'
```

Capture the printed URL and use it in the message to the user.

## Inputs

- `slug` — feature slug. Required. Derived from the user's idea if not
  supplied explicitly (kebab-case, e.g. `dark-mode`, `csv-export`).
- `patterns` — array of `{ name, description, pros?, cons? }` from the
  research subagent. 3–5 items is typical; the helper tolerates any count
  including zero (renders a "no patterns yet" placeholder).
- Feature scope from the scoping question (step 2) — used only as input
  to the research dispatch, not by this skill directly.

## Outputs

- `control/v5/features/{slug}/` — scaffolded folder (if it did not exist).
- `control/v5/features/{slug}/braindump.md` — the user's idea + scope
  (written in step 3; the brainstorm stage's required artifact).
- `control/v5/features/{slug}/ux-flow.html` — the rendered UX flow
  diagram with one selectable option per pattern.
- A dashboard URL opened in the user's default browser.

## Boundaries

- Do NOT implement search. The `parallel-web-search` skill (and its
  deep-research sibling) live in the superpowers/vendor bundle.
- Do NOT write a PRD, mock, or plan in this skill. Pattern selection
  feeds the next stage; brainstorming ends here.
- Do NOT skip the research offer. "Always offer research" is the
  load-bearing rule.
- Do NOT modify `lib/v5/auto-launch.mjs`. Treat it as a stable seam.
- Decisions from this flow are captured via the `mc-decide` skill.

## Never

- Dispatch research without first asking the user.
- Render patterns as plain text in chat — the diagram is the canonical
  artifact, not the chat transcript.
- Save selections client-side without going through the dashboard. The
  diagram's inline save script POSTs to `/api/v5/decisions/{slug}`; the
  skill does not write `decisions.json` directly.
