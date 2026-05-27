# Brief 02 — Web App (Org Control)

**Surface:** `app.missioncontrol.pro`
**Owner:** TBD
**Status:** Draft v0
**Last updated:** 2026-05-26

---

## Purpose

The web app is **the product**. It's where:

- Org admins define **workflows** and **standards**.
- Org admins manage **users**, **groups**, and **permissions**.
- Anyone in the org views the **live dashboard** of agents.
- Decision recipients **answer structured prompts** from running agents.

Everything else (marketing, mobile, bridge) supports this surface.

---

## Target users

| Persona | Primary view | Authority |
|---|---|---|
| **Owner / Admin** | Workflow editor, standards editor, permissions, billing | Full CRUD on org controls |
| **Engineering manager** | Dashboard (portfolio), audit log | Read-mostly, manage assignments |
| **Senior IC / dev lead** | Workflow editor (in their permission group) | Edit assigned resources |
| **Dev (rank & file)** | Dashboard (their work), decision inbox | Read + respond to own decisions |
| **PM / designer** | Dashboard, decision inbox | Read + respond to own decisions |

---

## Scope

### In scope (v1)

- **Projects:** named work containers with optional git repo linkage. One Project may link to many repos (multi-platform); one repo may link to many Projects (monorepo path scoping). Bridge auto-suggests linkage from `.git/config` on first workflow run; users can confirm or override. Archive a Project when retired.
- **Items (Features / Bugs / Epics):** every piece of work is an `item` with `type ∈ {epic, feature, bug}`. Two-level hierarchy — Epics group Features and Bugs; Features and Bugs have no children. Type-specific UX (bug severity, feature user story, epic child list). Items live inside a Project.
- **Workflow management:** create, edit, name, version, assign workflows to **users or Teams**.
- **Standards management:** versioned org-standards documents (markdown).
- **Permission Groups (org config access):** assign each user to exactly one Permission Group. System groups (Owner, Admin, Member) ship by default; admins can create custom groups with granular CRUD on workflows, standards, devices, audit log, billing.
- **Teams (workflow grouping):** create Teams like Designers, Engineers, PMs. Users can belong to many Teams. Workflows assign to Teams (or to individual users).
- **Live dashboard:** all active agent sessions across the org with stage, progress, blockers. Filterable by Project, Item, Epic, owner, branch, status. Each session row shows current git branch + ahead/behind main.
- **Feature view:** drill into a single in-flight feature — journal, decisions, history.
- **Decision inbox:** answer structured decisions (mirrors mobile decision-answering).
- **Device management:** list registered bridges, revoke devices, see online status.
- **Audit log:** every action that mutates org config, every spawn event from cloud.
- **Billing portal link:** redirect to Stripe Customer Portal.
- **Invite flow:** invite a user by email → assign them to a Permission Group + zero or more Teams on accept.
- **Telemetry toggle:** off by default; org admin can opt in to anonymous usage telemetry (no content).

### Out of scope (v1)

- **UI primitives library** — deferred. Standards markdown covers the same intent for v1.
- Comment threads on workflows.
- Branching / multi-draft workflows (single draft per user).
- Cross-org features (templates marketplace).
- Embedded chat with the agent (the agent stays in the IDE).
- Code review / diff review UI (we link out to GitHub or similar).

---

## Information architecture

```
Web App
├── /onboarding              # First-run after signup
├── /dashboard               # Live agents (Project/Item filters)
│   ├── /dashboard/item/{id}          # Single item drill-down (journal, sessions, branches)
│   └── /dashboard/decisions          # Decision inbox
├── /projects                # Project list
│   └── /projects/{slug}              # Project detail (repos, teams, items)
│       └── /projects/{slug}/items    # Items inside a project (epics, features, bugs)
├── /workflows               # Workflow list
│   └── /workflows/{slug}    # Editor + history
├── /standards               # Standards list
│   └── /standards/{slug}    # Editor + history
├── /people                  # Users, Teams, Permission Groups
│   ├── /people/users                 # All users + their permission group + teams
│   ├── /people/teams                 # Teams (workflow assignment groups)
│   └── /people/permission-groups     # Permission Groups (CRUD on org config)
├── /devices                 # Bridge devices
├── /audit                   # Audit log
└── /settings                # Org settings, billing, security, telemetry
```

---

## Key surfaces (v1)

### Workflow editor

The most differentiating piece of the product. Design priorities:

- **Author by editing a markdown document** with structured frontmatter and step blocks.
- **Live validation** against the workflow DSL schema (errors inline).
- **Preview pane** showing the rendered pipeline.
- **History panel** showing previous versions, with diff and rollback.
- **Assignment panel** showing which users/groups this workflow applies to.

Step types we ship in v1:
- `braindump` — interactive Q&A with the orchestrator
- `research` — subagent dispatched with research template
- `spec` — PRD-style document generation
- `mock` — UI mock generation, referencing org standards markdown
- `plan` — phased implementation plan
- `build` — subagent-driven dev with build gates
- `decide` — pause for a structured decision (open-shaped — mobile renders best-effort)
- `validate` — final gate (tests, lint, manual review)

### Standards editor

Simpler. A markdown document with a name, a description, and tags. The bridge pulls applicable standards into context packets at dispatch time. Examples a customer would write:

- "Backend code must follow hexagonal architecture with use-cases as the boundary."
- "All UI must use the tokens in `@acme/tokens`. Hardcoded color values fail review."
- "Tests are required for any new domain logic. UI tests optional."

### Live dashboard

The thing the CTO opens every morning.

- Org-wide list of in-flight agent sessions.
- Filterable by user, workflow, feature, stage, status.
- Each row shows: user, machine, feature, current stage, status indicator (running / awaiting decision / idle), last update.
- Realtime updates via Supabase Realtime subscriptions.
- "Open" launches the feature drill-down. "Answer" jumps to the decision inbox (if one is open for me).

### Permission Groups (CRUD on org config)

Every user belongs to **exactly one** Permission Group. Permission Groups have nothing to do with workflow assignment — they only govern what the user can do to org settings.

System groups (cannot be removed or have permissions reduced):
- **Owner** — full control, billing.
- **Admin** — full control except billing.
- **Member** — default for invited users, read-only on org config.

Admins can create custom groups with granular grants over these resource types:
- `workflow`, `standard`, `device`, `audit_log`, `billing`, `permission_group`, `team`

Each grant is `{ resource_type, resource_id_or_wildcard, action }` where action is `read | write | delete`.

There is no precedence question — single membership eliminates it. Changing a user's Permission Group is one explicit action by an Admin.

### Teams (workflow assignment)

Teams group users for workflow routing — e.g., Designers, Engineers, PMs. A user can belong to many Teams. Teams have **no** effect on org-config edit access.

Workflows assign to: an individual user, a Team, or a wildcard ("all org members"). At dispatch time, the orchestrator resolves the **union** of workflows assigned to the user + every Team they're in. If multiple workflows match a task type, the one marked `default: true` for that user's Team wins; if no default, the orchestrator emits a `decide` step asking the user.

### Decision inbox

When a workflow hits a `decide` step, a row is created in `decisions`. The recipient (user or Team) gets:
- A push notification on mobile if they have the app.
- An entry in their decision inbox in the web app.

Decision shape is **open** — the workflow author defines the request body and the response schema. Web renders both fully. Mobile renders best-effort and falls back to "Open in web" only if the user explicitly wants a larger surface. Answering writes back to the session and the agent resumes.

### Device management

- List of registered bridges with: hostname, OS, last seen, online state, current sessions.
- Per-device: rename, revoke (forces re-auth), force-disconnect.
- Per-org: kill switch (revoke *all* devices in one action — security feature).

### Audit log

Append-only. Filterable by actor, action, resource. Every:

- Config mutation (workflow saved, group changed, user invited).
- Spawn event (cloud told bridge to start a session).
- Permission change.
- Device action (registered, revoked, kill-switched).

---

## Tech stack

See `tech-stack.md`. Short:

- **Next.js 15** (App Router, RSC).
- **Tailwind + shadcn/ui**.
- **Monaco** for code blocks, **TipTap** for prose, custom renderer for workflow step blocks.
- **Supabase Realtime** for live updates.
- **React Hook Form + Zod**.
- **Hosted on Vercel.**

---

## Integration points

| Touchpoint | What happens |
|---|---|
| Supabase Auth | All routes behind login; RLS enforces org isolation |
| Supabase Realtime | Dashboard subscribes to `agent_sessions` + `decisions` changes |
| Stripe Customer Portal | Linked from `/settings/billing` |
| Bridge protocol (cloud side) | When user clicks "Start," cloud emits signed `spawn-session` event to that user's device |
| Mobile app | Decisions table is shared — answering on web closes the mobile push |
| Marketing site | Receives newly signed-up users at `/welcome` (onboarding) |

---

## Success metrics (v1)

| Metric | Target |
|---|---|
| Onboarded → first workflow saved | 70% within 24h |
| Onboarded → first agent session in dashboard | 50% within 48h |
| Weekly active admin users per org | 60% of admins |
| Weekly active dashboard viewers per org | 40% of members |
| Decision response time (p50) | < 4 hours during business hours |

---

## Open questions

1. **Workflow DSL surface.** Is the markdown DSL itself a customer-facing artifact (developer docs explain it, advanced users edit raw), or is it always wrapped by a rich editor? Lean: both — rich editor with "edit raw" toggle.
2. **Multi-org users.** Can one human be in multiple orgs? Lean: yes, with an org switcher. Cheap to support, hard to retrofit.
3. **Free tier in the web app.** If we have a Free tier with no cloud sync, what does the web app even show them? Lean: a paywall page with "Upgrade to Team to see your dashboard."
4. **Granularity of audit log.** Every keystroke or every saved version? Lean: every save / publish / spawn — not every keystroke.
5. **Read-only public links?** "Share dashboard view with a stakeholder without an account." Lean: out of v1, but data model should accommodate.
