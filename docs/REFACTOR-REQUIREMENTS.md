# Mission Control Kit v5 — Refactor Requirements

## Overview

Major refactor to make MCK more interactive, visual, and efficient. The target user is an **AI Orchestrator** — someone who directs AI to accomplish tasks and does no coding themselves. Every decision point should be reviewable via illustrated, interactive diagrams in the browser dashboard.

---

## 1. Pickup Prompt Compression

### Problem
Too much context fed into the orchestrator on pickup. Prompts are bloated with inline instructions, state summaries, and workflow rules.

### Requirements
- Pickup prompt = **1-2 sentences** + the stub reference + instruction on how to get context
- The orchestrator reads its own context on demand via document routing (see §2)
- Example pickup prompt:
  ```
  Resume feature "user-onboarding" at stage: mock.
  Read: docs/superpowers/control/features/user-onboarding/status.json
  Route: ROUTER.md → resolve context for current stage.
  ```
- No inline workflow rules, no embedded state summaries, no full pipeline instructions

### Acceptance Criteria
- Pickup prompt is ≤ 5 lines
- Orchestrator successfully resolves its own context from disk after receiving the prompt
- No regression in pipeline reliability

---

## 2. Document Routing

### Problem
Orchestrator and subagents load too many documents. No intelligent routing based on task type.

### Requirements
- Create a **routing manifest** that maps task types to required documents
- Route categories:
  | Task Type | Routes To |
  |-----------|-----------|
  | UI implementation | UI-REQUIREMENTS.md, layout primitives, wireframes |
  | UX decisions | UX-PATTERNS.md, interaction.html, flow diagrams |
  | Architecture | ARCHITECTURE.md, stack.json, tech decisions |
  | Research | relevant skill + user specs + research template |
  | Build | phase plan + BUILD-GATES.md + single task spec |
  | Brainstorm | product context + market research + user goals |
- Routing is resolved by `lib/mc-router.mjs` before dispatch
- Subagents receive **only** the documents relevant to their task
- Orchestrator reads **only** what it needs for coordination (status, handoff, routing)

### Acceptance Criteria
- Each subagent dispatch includes a resolved route (explicit file list)
- No subagent receives documents outside its task scope
- Router is extensible (new task types can be added without refactoring)

---

## 3. Interactive Decision Diagrams

### Problem
Decisions are made in chat (text-only). Hard to evaluate options without seeing them. Mocks are unreliably created and presented.

### Requirements

#### 3.1 Diagram Types
Three diagram primitives, each with illustrated selectable options:

**Architecture Diagrams**
- Show where code lives, where data is stored, how services connect
- Each option is a visual diagram (boxes, arrows, layers)
- User selects between architectural approaches (e.g., monolith vs microservices, SQL vs NoSQL)

**UX Flow Diagrams**
- Show how the user moves through the experience
- Flowchart with screens/steps as nodes
- Decision points with selectable branching paths
- Each path option is illustrated (not just labeled)

**UI Diagrams**
- Use HTML primitives to create simple layout representations
- Show different component options side-by-side (dialog vs drawer vs sheet, tab nav vs sidebar, etc.)
- Each option is a rendered mini-layout, not just a text description

#### 3.2 Interaction Model
- Every option within a diagram is **selectable** (radio, toggle, or click-to-select)
- Each option is **illustrated** — visual representation, not text labels
- User reviews options → makes selections → hits **Save**
- Save POSTs to dashboard server API → writes to `features/{slug}/decisions.json`
- Subagents read `decisions.json` to see user choices before proceeding

#### 3.3 Primitives & Examples
- Provide reusable HTML/CSS primitives for each diagram type
- Provide complete examples that subagents can model from
- Subagent's job: fill in the template with feature-specific content
- Primitives live in `control/layout/diagrams/` with subdirectories:
  - `architecture/` — architectural diagram primitives
  - `ux-flow/` — UX flow diagram primitives  
  - `ui-options/` — UI option comparison primitives

#### 3.4 Decision Persistence
- Decisions file: `features/{slug}/decisions.json`
- Schema:
  ```json
  {
    "stage": "mock",
    "decisions": [
      {
        "id": "navigation-pattern",
        "category": "ui",
        "question": "Primary navigation pattern",
        "options": ["tab-bar", "hamburger-menu", "sidebar"],
        "selected": "tab-bar",
        "decidedAt": "2026-05-26T10:00:00Z"
      }
    ],
    "pending": ["data-storage", "auth-flow"]
  }
  ```
- Dashboard API endpoint: `POST /api/decisions/{slug}` → writes to disk
- Subagents check `decisions.json` before work that depends on those choices

---

## 4. Brainstorming Flow Enhancement

### Problem
During brainstorming, research isn't proactively offered. Patterns aren't visually presented.

### Requirements
- When user describes a new feature, orchestrator **always asks** if they want web research
- If yes → invoke `parallel-web-search` skill (or `parallel-deep-research` if requested)
- Research subagent returns **patterns** (common approaches, industry standards, examples)
- A **new subagent** takes the patterns and creates an `.html` UX flow diagram
- The flow diagram shows the user journey with decision points
- Diagram is saved to `features/{slug}/ux-flow.html` and embedded in dashboard
- Dashboard server is launched automatically; user reviews in browser

### Acceptance Criteria
- Brainstorming always offers research
- Patterns are converted to visual UX flow diagrams (not just text)
- Diagrams are interactive (selectable options at decision points)
- Dashboard auto-launches for review

---

## 5. Auto-Launch Dashboard for Review

### Problem
User has to manually launch the dashboard server and navigate to it.

### Requirements
- When the orchestrator creates a visual artifact (diagram, mock, wireframe), it:
  1. Checks if dashboard server is running (read `.mc/dashboard-server.json`)
  2. If not running → launches it (`node control/scripts/dashboard-server.mjs`)
  3. Opens the browser to the relevant page/section
- The orchestrator tells the user: "I've opened the dashboard for you to review [artifact]."
- If user says "I want to review" at any point → same auto-launch behavior

### Acceptance Criteria
- Dashboard launches automatically when visual artifacts are created
- Browser opens to the correct page (not just the homepage — navigates to the feature)
- Works on macOS (`open` command) and Linux (`xdg-open`)

---

## 6. Dashboard Overhaul

### Problem
Current dashboard is a single-page card grid with modal details. Too complex, not focused on the AI Orchestrator workflow.

### Requirements

#### 6.1 New Layout — Three Sections

**Section 1: Live Agents**
- Shows anything currently in progress
- For each active item: what it's working on, current phase, progress toward phase completion
- Progress indicator (e.g., "Task 3/7 in Phase 2")
- Minimal — just enough to know what's happening

**Section 2: Up Next**
- The next product/feature/tech item in the build queue
- User can open it (full-page **navigation**, not a modal)
- On the detail page: interactive diagrams with current decisions
- User can change options, save, redirect key decisions before build starts

**Section 3: All Items**
- Selector UI to filter what's shown:
  - **"Needs Your Input"** — items the user hasn't progressed through (pending decisions)
  - **"Ready for Development"** — items fully decided, queued for agent pickup
  - **"In Progress"** — items currently being built
  - **"Complete"** — finished items
- Simple, clean list/grid

#### 6.2 Navigation Model
- **No more modals** for feature details
- Full-page navigation: dashboard → feature detail page → back
- Feature detail page includes:
  - Interactive diagrams (architecture, UX, UI) with current selections
  - Decision history
  - Progress timeline
  - Pickup prompt (copy button)

#### 6.3 Visual Design
- Cleaner, simpler than current
- Dark theme (keep existing palette as baseline)
- Focus on readability and decision-making
- Less information density — show what matters for the AI Orchestrator role

### Acceptance Criteria
- Three-section layout implemented
- Modal replaced with page navigation
- Filter/selector works for All Items
- Feature detail page shows interactive diagrams
- Responsive, works well at standard desktop widths

---

## 7. Diagram-in-Dashboard Integration

### Requirements
- Interactive diagrams are embedded in the feature detail page
- When a subagent creates a diagram, it's automatically visible in dashboard
- User can:
  1. View the diagram
  2. Select options within it
  3. Save selections
  4. Selections persist to `decisions.json`
  5. Return later and see their previous selections
- Dashboard reads `decisions.json` on page load to show current state

### Acceptance Criteria
- Diagrams render inline in feature detail pages
- Selections are preserved across page reloads
- Save writes to disk via API
- Subagents can read saved decisions before proceeding

---

## 8. Mock Project for Testing

### Requirements
- Create a mock project within `mission-control-kit/` for integration testing
- Located at `sample-project/` (already exists — repurpose/expand)
- Contains:
  - 2-3 features at different pipeline stages
  - Pre-built decision diagrams (one of each type: architecture, UX, UI)
  - Pre-populated `decisions.json` files
  - A feature in "Needs Your Input" state
  - A feature in "Ready for Development" state
  - A feature in "In Progress" state
- Used for:
  - Testing dashboard rendering
  - Testing decision save/load flow
  - Testing diagram interactivity
  - Testing auto-launch behavior
  - Visual QA of the new dashboard layout

### Acceptance Criteria
- `npm run dashboard` works with mock data
- All three diagram types render and are interactive
- Decision save/load round-trips successfully
- Dashboard three-section layout displays correctly with mock data

---

## 9. Decision Sequencing

### Problem
Decisions are made in an ad-hoc order. Architecture choices get made before UX is understood, leading to tech constraints that force backtracking on user experience.

### Core Principle
**UX first. Always.** Unless the user is explicitly describing a tech-stack item, the orchestrator follows this sequence:

```
UX Decisions → UI Decisions → Architecture/Tech Decisions → Build
```

Why this order:
1. **UX first** — How does the user experience this? What's the journey? What are the decision points? Without this, everything else is a guess.
2. **UI second** — Now that we know the flow, what does each screen/state look like? Component choices, layout patterns, visual hierarchy.
3. **Architecture third** — Now that we know what we're building for the user, what technical decisions support it? Data models, APIs, services, infrastructure.
4. **Build last** — Execute with all decisions locked in. No backtracking.

### Exception: Tech-Stack Items
When the user is describing pure tech (`/mc-init`, tech-stack items), the sequence is:
```
Architecture Decisions → Build
```
No UX/UI phase needed for scaffolding, CI, database setup, etc.

### Requirements

#### 9.1 Orchestrator Routing by Decision Phase
The orchestrator knows which decision phase the feature is in and routes accordingly:

| Decision Phase | Orchestrator Action | Documents Routed |
|---------------|--------------------|--------------------|
| UX | Ask user journey questions, offer research, present UX flow diagrams | UX-PATTERNS.md, research outputs, flow primitives |
| UI | Present component/layout options as interactive diagrams | UI-REQUIREMENTS.md, layout primitives, wireframe skeletons |
| Architecture | Present system design options as architecture diagrams | ARCHITECTURE.md, stack.json, tech decisions |
| Build | Dispatch build subagents | phase plan, BUILD-GATES.md, task spec |

#### 9.2 Transition Gates
The orchestrator does NOT advance to the next phase until:
- All decisions in the current phase are saved to `decisions.json`
- User has reviewed the interactive diagram
- No "pending" decisions remain for that phase

#### 9.3 Status Tracking
`decisions.json` tracks phase completion:
```json
{
  "phases": {
    "ux": { "status": "complete", "decisions": [...] },
    "ui": { "status": "in-progress", "decisions": [...], "pending": ["settings-layout"] },
    "architecture": { "status": "not-started" }
  }
}
```

#### 9.4 Backtracking Prevention
- Router refuses to load architecture documents during UX phase
- If user asks a tech question during UX phase, orchestrator acknowledges it, notes it in `decisions.json` under a "deferred" key, and continues UX
- Deferred questions surface automatically when the architecture phase begins

### Acceptance Criteria
- Orchestrator follows UX → UI → Architecture → Build for all features
- Tech-stack items skip directly to Architecture → Build
- Phase transitions require all decisions saved
- Attempting to make out-of-order decisions gets deferred (not blocked — user isn't frustrated, just redirected)
- Deferred decisions surface at the right time

---

## 10. MVVM Architecture Enforcement

### Problem
Subagents produce inconsistent code architecture. No prescribed pattern means every feature gets built differently, making the codebase harder to navigate and maintain.

### Requirements

#### 10.1 MVVM as the Standard Pattern
All feature builds must follow MVVM (Model-View-ViewModel):
- **Model** — Data layer. Types, API contracts, persistence, validation.
- **View** — UI layer. Renders state, dispatches user actions. No business logic.
- **ViewModel** — Business logic and state management. Transforms models for views, handles user actions, manages side effects.

#### 10.2 Routing Integration
The `ARCHITECTURE.md` routing document must include:
- MVVM structure expectations for every feature
- File naming conventions (e.g., `{feature}.model.ts`, `{feature}.view.tsx`, `{feature}.viewmodel.ts`)
- Boundary rules: Views never import Models directly, ViewModels are the bridge
- State flow: View → ViewModel (actions) → Model (mutations) → ViewModel (derived state) → View (render)

#### 10.3 Build Subagent Instructions
When the build subagent is dispatched:
- Context packet includes MVVM structure requirements
- Task spec explicitly names which layer the task targets (Model, View, or ViewModel)
- Spec reviewer checks for MVVM boundary violations (View importing Model, business logic in View, etc.)

#### 10.4 Architecture Decisions Phase
During the Architecture decision phase (§9), the orchestrator presents:
- How the feature maps to MVVM layers
- Which ViewModels are needed
- Data flow between layers
- The architecture diagram illustrates MVVM boundaries

### Acceptance Criteria
- Build subagents produce code following MVVM separation
- Spec reviewer flags boundary violations
- Architecture diagrams show Model/View/ViewModel layers
- File structure follows naming conventions

---

## 11. Parallel Execution by Default

### Problem
The orchestrator runs tasks sequentially even when they have no dependencies on each other. This wastes time when multiple independent tasks could be dispatched simultaneously.

### Requirements

#### 11.1 Core Rule
If work CAN be parallelized, it MUST be parallelized. Sequential execution is only acceptable when there is a true data dependency between tasks.

#### 11.2 Parallelization Points

| Phase | Parallel Opportunities |
|-------|----------------------|
| Research | Multiple research queries dispatched simultaneously |
| Explore | Multiple codebase explorations at once |
| Brainstorming | Research + diagram generation can overlap |
| Plan | Platform plans for independent platforms in parallel |
| Build | Independent tasks within a phase (no shared files) |
| Review | Spec review + quality review can overlap across different tasks |

#### 11.3 Dependency Detection
The orchestrator determines parallelizability by checking:
- Do the tasks touch the same files? → Sequential
- Does task B require output from task A? → Sequential
- Are they operating on different features/modules? → Parallel
- Are they read-only operations? → Always parallelizable

#### 11.4 Build Phase Parallelism
Within a build phase, tasks are parallel by default unless:
- They modify the same file
- One task's output is another task's input
- They share database migrations or schema changes

The phase plan must explicitly mark task dependencies. Unmarked tasks are assumed independent and dispatched in parallel.

#### 11.5 Orchestrator Behavior
- Before dispatching, orchestrator scans remaining tasks for independence
- Groups independent tasks and dispatches all at once
- Waits for all parallel tasks to complete before moving to dependent tasks
- Reports parallel dispatch to user: "Dispatching 3 tasks in parallel: [list]"

### Acceptance Criteria
- Orchestrator dispatches independent tasks simultaneously
- Build phase tasks without explicit dependencies run in parallel
- No regression from parallel execution (file conflicts caught before dispatch)
- Observable speedup on multi-task phases

---

## Implementation Order

Suggested sequencing (each item is a discrete task):

1. **Diagram primitives** — Create the three diagram type templates (architecture, UX flow, UI options) with HTML/CSS/JS. These are the building blocks everything else depends on.

2. **Decision persistence** — `decisions.json` schema, dashboard API endpoint (`POST /api/decisions/{slug}`), read/write utilities.

3. **Mock project setup** — Expand `sample-project/` with features at different stages, pre-built diagrams, and decisions data.

4. **Dashboard overhaul** — New three-section layout, page navigation (no modals), feature detail pages with embedded diagrams.

5. **Diagram-in-dashboard integration** — Wire interactive diagrams into feature detail pages, connect to decisions API, handle save/load.

6. **Auto-launch dashboard** — Server detection, auto-start, browser open, navigate to relevant section.

7. **Pickup prompt compression** — Rewrite prompt builder to emit minimal prompts. Update orchestrator to self-resolve context.

8. **Document routing enhancement** — Routing manifest, task-type-to-document mapping, integration with `mc-router.mjs`.

9. **Brainstorming flow** — Research offer, pattern extraction, UX flow diagram generation from patterns.

10. **End-to-end testing** — Full pipeline test with mock project: brainstorm → research → diagram → decisions → build.

---

## Non-Goals (for this refactor)

- Mobile dashboard support
- Multi-user collaboration
- Real-time sync between dashboard and chat
- Changing the core pipeline stages (braindump → explore → ... → validate)
- Modifying the build/review workflow (SDD+TDD patterns stay the same)

---

## Technical Constraints

- Dashboard remains static HTML generated by Node scripts (no React/Vue)
- Client-side JS for interactivity (vanilla JS, no framework)
- Server is the existing Express-like HTTP server (`dashboard-server.mjs`)
- All state on disk (JSON files) — no database
- Diagrams are self-contained HTML files (embeddable via iframe or inline)
- Must work with both Cursor and Claude Code agent environments
