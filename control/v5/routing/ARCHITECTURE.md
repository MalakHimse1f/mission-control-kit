# Architecture

System design patterns, technical decisions, and data flow architecture for v5 features.

## Purpose

This document prescribes the technical foundation for v5 feature builds. All features must follow the MVVM pattern, and this document ensures consistency across Model, View, and ViewModel layers. Architecture subagents use this to generate architecture diagrams and system design specs.

## MVVM Layering

All feature builds must follow MVVM (Model-View-ViewModel):

- **Model** — Data layer. Types, API contracts, persistence, validation.
- **View** — UI layer. Renders state, dispatches user actions. No business logic.
- **ViewModel** — Business logic and state management. Transforms models for views, handles user actions, manages side effects.

### Key Rules

- Views never import Models directly. ViewModels are the bridge.
- State flow: View → ViewModel (actions) → Model (mutations) → ViewModel (derived state) → View (render)
- File naming conventions: `{feature}.model.ts`, `{feature}.view.tsx`, `{feature}.viewmodel.ts`
- Build specs must name which layer a task targets (Model, View, or ViewModel)
- Spec reviewer checks for MVVM boundary violations before approval

## Naming Convention

Every feature is built from three sibling files in the same directory:

| Layer | File pattern | Imports |
|-------|--------------|---------|
| Model | `{feature}.model.ts` | nothing from View or ViewModel |
| ViewModel | `{feature}.viewmodel.ts` | the Model; never imports a View |
| View | `{feature}.view.tsx` | the ViewModel; **never** the Model |

`.jsx`/`.js` variants are accepted by the linter for JS-only projects, but TypeScript is preferred. Do not invent alternates like `{feature}-model.ts` or `{feature}/index.tsx` — the linter and spec reviewer both rely on these exact patterns.

## Data Flow

```
   ┌──────────┐    user actions    ┌────────────┐    mutations    ┌─────────┐
   │   View   │ ─────────────────▶ │ ViewModel  │ ──────────────▶ │  Model  │
   │ (.view)  │                    │ (.viewmodel)│                │ (.model)│
   │          │ ◀───── render ──── │            │ ◀── data ────── │         │
   └──────────┘    derived state   └────────────┘                 └─────────┘
```

- **Down (write path):** user gesture → View dispatches → ViewModel decides → Model mutates.
- **Up (read path):** Model exposes data → ViewModel selects/derives → View renders.

The View only sees the ViewModel. The Model only sees itself. The ViewModel is the only layer that knows about both.

## Right and Wrong Patterns

### Wrong: View imports Model directly

```tsx
// onboarding.view.tsx — WRONG
import { User, fetchUser } from './onboarding.model'; // forbidden import
import React from 'react';

export function OnboardingView() {
  const [user, setUser] = React.useState<User | null>(null);
  React.useEffect(() => {
    fetchUser().then(setUser);             // forbidden: data fetching in View
  }, []);
  return <div>{user?.name}</div>;
}
```

Why this is wrong: the View now owns business logic (when to fetch, what to do with errors, how to cache). When the ViewModel needs to add caching or loading states, every View must change.

### Right: View only imports its ViewModel

```tsx
// onboarding.view.tsx — RIGHT
import React from 'react';
import { useOnboardingVM } from './onboarding.viewmodel';

export function OnboardingView() {
  const { user, isLoading, retry } = useOnboardingVM();
  if (isLoading) return <div>Loading…</div>;
  return (
    <div>
      <span>{user?.name}</span>
      <button onClick={retry}>Retry</button>
    </div>
  );
}
```

```ts
// onboarding.viewmodel.ts — RIGHT
import { useEffect, useState } from 'react';
import { fetchUser, type User } from './onboarding.model';

export function useOnboardingVM() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    fetchUser().then((u) => { setUser(u); setLoading(false); });
  };
  useEffect(load, []);
  return { user, isLoading, retry: load };
}
```

```ts
// onboarding.model.ts — RIGHT
export type User = { id: string; name: string };

export async function fetchUser(): Promise<User> {
  const res = await fetch('/api/user');
  return (await res.json()) as User;
}
```

The View never touches `fetch`, never knows what `User` is at the type-definition level (it only sees what the ViewModel exposes), and the Model never knows a View exists.

### Wrong: Model importing the View

```ts
// onboarding.model.ts — WRONG
import { OnboardingView } from './onboarding.view'; // forbidden — Model is a leaf
```

Models must be dependency leaves. If a Model needs to know about UI concerns (rare), the dependency is inverted: define the type in the Model and have the View implement it.

## Automated Boundary Checks

The repository ships a lint module at `lib/v5/mvvm-lint.mjs` that enforces every rule on this page:

- `lintMVVM(diff)` — scans a unified diff for added lines that violate boundaries. Used by code-review hooks.
- `lintFiles({ root, files })` — reads files on disk and runs the same checks, plus the feature-level "view-without-viewmodel" check.

The four violation types it emits:

| Type | Detects |
|------|---------|
| `view-imports-model` | A `*.view.{ts,tsx,jsx}` file importing from a `*.model` specifier |
| `view-has-data-fetch` | A View containing `fetch(`, `axios.`, `await db.`, or `new XMLHttpRequest(` |
| `model-imports-view` | A `*.model.{ts,tsx,jsx}` file importing from a `*.view` specifier |
| `view-missing-viewmodel` | A directory with a `*.view.tsx` but no sibling `*.viewmodel.{ts,tsx,jsx}` |

The v5 build subagent (`skills/mc-v5-build/SKILL.md`) instructs the spec reviewer to run this lint against every changed file set. Any violation blocks task approval unless explicitly justified in the review notes.

## Build Subagent Hook

The build subagent skill at `skills/mc-v5-build/SKILL.md`:

- Requires every task spec to declare `Layer: Model | View | ViewModel | N/A`.
- Forbids combining layer changes in a single task.
- Routes the verbatim MVVM section of this document into every implementer dispatch.
- Requires the spec reviewer to run `mvvm-lint` before approval.

## Decision visualization

Architecture decisions render as visual cards on the feature page, the same
way UX and UI decisions do. Every architecture decision in `decisions.json`
under `phases.architecture.decisions[]` has a sibling fragment file in
`features/{slug}/decisions/`. The fragment is produced by the build-decision
CLI; the orchestrator and architecture subagent never hand-author it.

### The `mc-arch-node` / `mc-diagram-surface` primitive

Architecture decisions render one card per option. Each card's visual is a
`mc-diagram-surface` containing a small node/edge schematic built from
`mc-arch-node` primitives. These live in
`control/layout/diagrams/architecture/template.html`. Shape:

```html
<div class="mc-diagram-surface">
  <div class="mc-arch-node mc-arch-client">Client</div>
  <div class="mc-arch-edge"></div>
  <div class="mc-arch-node mc-arch-service">Sync worker</div>
  <div class="mc-arch-edge"></div>
  <div class="mc-arch-node mc-arch-store">Storage</div>
</div>
```

`lib/v5/decision-visual-builder.mjs` selects the node/edge layout per option
based on keyword matching against the option string (sync vs. async,
direct vs. queued, single-service vs. fan-out). You do not assemble these
`<div>`s by hand — the CLI does it deterministically from the decision data.

### When to use architecture decisions

Use `category: 'engineering'` (sometimes `category: 'architecture'` in
older fixtures — both accepted) and the diagram-surface visual when the
choice is about *where code or data lives, how services connect, or which
storage / transport layer carries the data*. Examples:

- "How does the importer move files to storage?" — pick a transport.
- "Where does the parser run?" — pick a service.
- "How do we cache responses?" — pick a cache layout.

Do not use architecture decisions for user-journey ordering (UX) or for
surface placement (UI).

### Worked example: personal-library-import / arch-transport

The decision in `decisions.json`:

```json
{
  "id": "arch-transport",
  "category": "engineering",
  "question": "How does the importer move file bytes from the browser into long-term storage?",
  "options": [
    "Direct browser → S3 pre-signed PUT",
    "Browser uploads to API, API streams to storage",
    "Browser uploads chunks to a queue, worker drains queue into storage"
  ],
  "selected": "Browser uploads chunks to a queue, worker drains queue into storage",
  "decidedAt": "..."
}
```

To produce the visual fragment:

```
node lib/v5/cli/build-decision.mjs personal-library-import arch-transport
```

The CLI writes `features/personal-library-import/decisions/arch-transport.html` —
a `mc-options-grid` fragment with one `mc-option-card` per option, each
carrying a `mc-diagram-surface` visual whose nodes and edges reflect the
transport (direct PUT vs. proxied stream vs. queue + worker).

You do not write that HTML. The CLI uses `lib/v5/decision-visual-builder.mjs`
and produces it deterministically from the decision data.

### Where this fits alongside MVVM

The MVVM section above governs the *code* inside a feature: how Model,
View, and ViewModel files relate. The fragments described here govern the
*decision page* for the feature: how each architectural choice is shown
to the user during the architecture phase. The two are orthogonal — every
feature has both an MVVM file layout *and* a set of decision fragments.

### The hard rule

> **You MUST NOT write HTML for a decision card by hand.** Every decision in `decisions.json` requires a sibling fragment file generated by `node lib/v5/cli/build-decision.mjs <slug> <decision-id>`. If a decision has no fragment, the feature page falls back to plain text cards — this is a failure mode, not an acceptable state.
