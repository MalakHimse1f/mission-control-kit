# Mission Control Pro — Shipping Plan

**Last updated:** 2026-05-26
**Status:** Draft v0 — for review

This document breaks Mission Control Pro into **shippable phases**, each one a single end-to-end user experience that can be tested in real UI before the next phase starts.

---

## Principles

1. **One phase = one new UX.** Each phase delivers a complete user-facing flow — sign-up, invite a teammate, install the bridge, see an agent in the dashboard. Not "half the data model."
2. **Each phase is e2e testable in real UI.** Automated where possible (Playwright on web flows, integration tests on bridge protocol). Where automation isn't realistic (installer on a real OS, push notifications, agent execution), the user performs an explicit acceptance test from a written script.
3. **No phase ships behind a feature flag.** When the phase is done, it's live. Phase boundaries are real seams.
4. **Each phase has an exit criterion.** "Phase done" is the criterion passing in the production-like environment, not "code merged."
5. **The MSP cutoff is explicit.** Phases 1–14 = MSP. Phase 15 makes it sellable. Phase 16 is GA polish. Phases 17+ are post-launch, sequenced but not gating.

---

## Phase summary

| # | Phase | Surface | E2E user test |
|---|---|---|---|
| 1 | Marketing site + auth + org creation | Marketing site, web app login | Visitor signs up, lands on Welcome screen, signs out, signs back in |
| 2 | Org settings (basic schema) | Web app `/settings` | Owner views & edits org name, sees plan info |
| 3 | Invitations | Web app `/people/users` | Owner invites a teammate by email; teammate receives, accepts, joins |
| 4 | Permission Groups | Web app `/people/permission-groups` | Owner creates a custom group, assigns a user to it |
| 5 | Granular permissions | Permission Group editor | Owner sets a group to "edit workflows only"; member can edit but not invite |
| 6 | Teams | Web app `/people/teams` | Owner creates "Engineers" team, adds users; users see team in profile |
| 7 | Standards (versioned docs) | Web app `/standards` | Owner writes "TDD" standard; sees history; saves a draft |
| **8** | **Projects (named + optional repo linkage)** | Web app `/projects` | Owner creates "Customer Portal" Project; optionally links 2 git repos; assigns a Team |
| **9** | **Items (Features / Bugs / Epics with hierarchy)** | Web app `/projects/{slug}/items` | Owner creates an Epic, adds 2 Features and 1 Bug under it; archives a Feature |
| 10 | Bridge installer + pairing | Local bridge + `/devices` | User downloads installer, runs it, pairs via code, sees device in web |
| 11 | Bridge sync + git detection + offline-block | Bridge tray + `/devices` | Bridge auto-detects repo URL + current branch; offers to link to Project; refuses to spawn when cloud unreachable |
| 12 | Curated workflow + orchestrator skill | Local: `claude /mcp-feature` | User picks an Item, runs the curated workflow; journal entries appear; branch + commit reported per session |
| 13 | Cloud dashboard + live streaming | Web app `/dashboard` | User runs agent locally; teammate watches live; dashboard filterable by Project, Item, Epic, branch |
| 14 | Web-side decision answering | `/dashboard/decisions` | Agent pauses on `decide` step → user answers in web → agent resumes |
| **— MSP cutoff —** | | | |
| 15 | Billing + plan limits | Marketing pricing, Stripe Checkout, `/settings/billing` | Visitor signs up → upgrades to Team → invites 3 teammates; Free org blocked at 2 users |
| 16 | GA polish | Status page, security page, docs, onboarding refinement | Cold visitor flows through landing → signup → install → first agent without support |
| 17+ | Post-launch roadmap | (see below) | Cloud→bridge spawn, custom workflows, mobile, Cursor, Enterprise, deployment tracking |

---

## Phase 1 — Marketing site + Auth + Org creation

**Goal.** A visitor lands on the marketing site, signs up, creates an org, and lands on a Welcome screen. They can sign out and sign back in.

### What ships (UX)

- **Public marketing site** at `missioncontrol.pro`:
  - Hero with bold text + subtext (copy TBD with marketing)
  - "Sign up" and "Sign in" buttons
  - Nothing else — no pricing, no docs, no blog
- **Sign-up flow**:
  - Email + password (or Google OAuth)
  - Verify email
  - "Create your org" screen — org name + slug
  - Lands on **Welcome to Mission Control Pro** screen
- **Sign-in flow**: existing user signs in → straight to Welcome screen
- **Sign-out** from a header menu → back to marketing landing

### Visual direction (locked)

- **Black background, white text** across the site
- **Bold, IMPACT-style font** (use `Impact` as the named family or a similar grotesque condensed) for hero + headings
- **Simple UI primitives** — buttons, inputs, cards
- **All styling at the global stylesheet level** — no component-specific overrides. One CSS file (or one Tailwind config + base layer) drives every screen.
- Sets the tone for every later phase: any new component picks up the right look automatically.

### Spec requirements

- **Tech**: Astro for the marketing landing, Next.js app at `app.missioncontrol.pro` for the authenticated surface (per [tech-stack.md](tech-stack.md)).
- **Auth**: Supabase Auth (email + password, Google OAuth as a v1.1 optional).
- **Data model used**: `users`, `orgs`, `org_members` (Owner role assigned at signup).
- **Global styles**: a single `globals.css` (or Tailwind base + theme tokens) shared by both Astro and Next.js apps. Lives in `@mcp/ui`.

### Out of scope for this phase

- Pricing page
- Bridge download
- Docs / blog / changelog
- Multi-org membership (one user = one org for now)
- Free / Team / Enterprise tiers (single tier exists internally)

### E2E acceptance criteria

Playwright test, runs against staging:

1. Visit `missioncontrol.pro` → hero is visible, bold IMPACT font is rendered (assertion against computed font-family).
2. Click "Sign up" → fill email + password → submit.
3. Receive verification email (Resend test mode) → click link.
4. Land on "Create your org" → enter "Acme Test" → submit.
5. Land on Welcome screen → screen shows "Welcome to Mission Control Pro" + org name.
6. Sign out → returned to marketing landing.
7. Sign in → land on Welcome screen.

### User-test acceptance

A human visitor, on macOS Safari and Chrome and Windows Edge, completes the same flow in under 60 seconds and reports: "The IMPACT font looked right; nothing was jarring; sign-out worked."

### Dependencies

None — starting point.

---

## Phase 2 — Org settings (basic schema)

**Goal.** Owners can see and edit their org's basic info.

### What ships (UX)

- **`/settings`** page in the web app
- Shows: org name (editable), slug (read-only after creation), creation date, current plan (read-only — `internal-only` until Phase 15)
- Saves org name changes

### Spec requirements

- `orgs` table fields exposed: `name`, `slug`, `created_at`, `plan`
- Update endpoint (RLS-enforced: only Owner can write)
- Form: React Hook Form + Zod

### Out of scope

- Plan upgrades (Phase 15)
- Billing portal (Phase 15)
- Telemetry toggle (decided opt-in only — ship Phase 15)
- Deleting an org

### E2E acceptance criteria

1. Owner visits `/settings`.
2. Org name field is editable; slug is read-only.
3. Owner edits org name → save → toast confirms → name updates in header.
4. Member (non-Owner) visits `/settings` → form is read-only.

### User-test acceptance

Owner edits org name, refreshes page, name persists. Member confirms they cannot edit.

### Dependencies

Phase 1.

---

## Phase 3 — Invitations

**Goal.** Owners invite teammates by email; teammates receive an email, click through, set their password, and join the org.

### What ships (UX)

- **`/people/users`** lists all org members
- **"Invite member"** button → modal with email input (single or comma-separated)
- Invited user receives email (Supabase invitation flow + Resend templates)
- Clicking invitation link → sign-up screen pre-populated with email + invitation token
- User sets password → joins org (assigned to "Member" Permission Group by default)
- Owner sees pending invitations + status (Pending / Accepted / Expired)
- Owner can resend or revoke a pending invitation

### Spec requirements

- Supabase invitations (`supabase.auth.admin.inviteUserByEmail`) wrapped by an Edge Function that also creates the `org_members` row on accept.
- `org_members` row created at invite time with `status: 'pending'`, flipped to `'active'` on accept.
- Email template: Resend, branded with global styles.

### Out of scope

- Bulk CSV import
- SSO / SAML provisioning (Enterprise, post-MSP)
- Domain-based auto-join

### E2E acceptance criteria

1. Owner clicks "Invite member" → enters `test@example.com` → submits.
2. Invitation row appears in pending list.
3. Resend test inbox receives a message with a working link.
4. Clicking link opens sign-up form with email pre-filled.
5. Setting password → lands on Welcome screen as a member of the org.
6. Owner refreshes → invited user appears in members list with status "Active."

### User-test acceptance

Owner invites a second human (real email), the human accepts on their own machine, both see each other in the members list.

### Dependencies

Phase 1, Phase 2.

---

## Phase 4 — Permission Groups (system + custom creation)

**Goal.** Owners can create custom Permission Groups beyond the built-in system groups. Users are reassignable between groups.

### What ships (UX)

- **`/people/permission-groups`** lists all Permission Groups in the org
- System groups (Owner, Admin, Member) are shown but locked — cannot be edited or deleted
- "New Permission Group" → name + description → save (no granular permissions yet — that's Phase 5)
- Custom groups can be renamed and deleted
- Per-user in `/people/users`: each user has a Permission Group dropdown showing their current group (Owner only sees this control)
- Reassigning a user is a single explicit action with confirmation

### Spec requirements

- `permission_groups` table with `system boolean` flag
- `org_members.permission_group_id` FK (NOT NULL — every user has exactly one group)
- Bootstrap: every new org seeded with Owner, Admin, Member rows
- Owner is the only Permission Group that can manage Permission Groups (for now)

### Out of scope

- Granular CRUD grants (Phase 5)
- Deny grants (never — most-permissive only)
- Composing groups (single membership)

### E2E acceptance criteria

1. Owner visits `/people/permission-groups` → sees Owner / Admin / Member, all marked "system."
2. Owner creates "Workflow Editor" → appears in list.
3. Owner edits a user from Member → Workflow Editor → user's row updates.
4. New user (signed up in Phase 3) defaults to Member.
5. Member viewing the page sees the list but cannot create or edit.

### User-test acceptance

Owner creates a custom group, assigns a user, signs in as that user, observes (in Phase 5) that the permissions changed appropriately.

### Dependencies

Phase 1, Phase 3.

---

## Phase 5 — Granular permissions system

**Goal.** Each Permission Group has fine-grained CRUD grants over org config resources. Editing those grants visibly changes what users in the group can do.

### What ships (UX)

- Click a custom Permission Group → editor with a **permissions matrix**:
  - Rows: resource types (`workflow`, `standard`, `device`, `audit_log`, `billing`, `permission_group`, `team`)
  - Columns: `read`, `write`, `delete`
  - Checkboxes per cell
- System groups show their fixed permissions read-only
- Saving updates `permission_grants` rows
- Web app sidebar items and action buttons honor the user's resolved permissions (greyed out / hidden if disallowed)

### Spec requirements

- `permission_grants(permission_group_id, resource_type, resource_id|wildcard, action)`
- Permission check helper (server + client): given user → resolves to their Permission Group → answers `can(resource, action)?`
- All write actions on the web app check permissions before submitting
- RLS policies in Postgres enforce the same checks server-side (belt + suspenders)

### Out of scope

- Per-resource-instance grants (e.g., "edit this specific workflow only") — v2
- Time-bounded grants
- Deny grants

### E2E acceptance criteria

1. Owner creates "Workflow Editor" with `write` on `workflow` only.
2. Owner assigns Test User to the group.
3. Test User signs in → can edit workflows but cannot edit standards or invite teammates (those controls are hidden / disabled).
4. Owner removes `write` on `workflow` → Test User refreshes → can no longer save workflows; attempting via API returns 403.

### User-test acceptance

Owner creates two custom groups with different permissions, signs in as users in each, confirms UI reflects the differences.

### Dependencies

Phase 4.

---

## Phase 6 — Teams (workflow grouping)

**Goal.** Owners can create Teams (Designers, Engineers, PMs). Users can belong to many. Teams are independent of Permission Groups.

### What ships (UX)

- **`/people/teams`** lists Teams
- "New Team" → name + description → save
- Per-team page: list of members + add/remove
- Per-user page (`/people/users/{user}`): shows their Permission Group + every Team they're in
- No workflows yet — Teams are a grouping primitive that Phase 7+ will use

### Spec requirements

- `teams(id, org_id, slug, name, description)` + `team_members(team_id, user_id)` many-to-many
- Permission to manage Teams comes from `permission_grants` on resource type `team`
- Bootstrap: no default Teams (orgs add as needed)

### Out of scope

- Workflow assignment (Phase 12 — when the curated workflow ships)
- Team-level standards
- Nested teams

### E2E acceptance criteria

1. Owner creates "Engineers" team.
2. Owner adds 2 users to it.
3. Each added user's profile shows "Engineers" team membership.
4. Removing a user removes the membership; user can be re-added.
5. Deleting a Team removes all `team_members` rows but does not delete users.

### User-test acceptance

Owner creates 2 teams with overlapping membership, confirms users appear in both, confirms removing from one doesn't affect the other.

### Dependencies

Phase 5.

---

## Phase 7 — Standards (versioned markdown documents)

**Goal.** Owners and authorized users can write versioned standards documents. These will be consumed by the curated workflow in Phase 12.

### What ships (UX)

- **`/standards`** lists all standards in the org
- "New standard" → name + slug + body (markdown editor) → save (creates version 1)
- Edit standard → opens latest version, can save changes as a new published version OR save as draft
- One draft per author per standard (per the version-control decision)
- History panel → list of versions + diff view (side-by-side markdown)
- Rollback = publish a previous version as a new head

### Spec requirements

- `standards(id, org_id, slug, name, current_version_id)`
- `standard_versions(id, parent_id, body_md, author_id, published_at, is_head)`
- `standard_drafts(standard_id, author_id, body_md, base_version_id)` — unique on `(standard_id, author_id)`
- Markdown rendered with a safe sanitizer
- Diff: side-by-side rendering (left = base, right = candidate), highlight added/removed lines

### Out of scope

- Branches / merge UI
- Comments
- Attachments / uploaded files (defer — markdown only for v1)
- UI primitives library (per [Issue 10 deferral](decisions/10-ui-primitives-scope.html))

### E2E acceptance criteria

1. Owner creates "TDD" standard with sample body → published as v1.
2. Owner edits body → saves as draft → doesn't change the published version.
3. Owner publishes draft → new version (v2) becomes head.
4. Owner views history → sees v1 and v2; diff view highlights the change.
5. Owner rolls back to v1 → new version (v3) created with v1's body.
6. User without `write` permission on `standard` cannot edit (matrix from Phase 5 honored).

### User-test acceptance

Owner writes their actual MVVM standard, drafts a change, has a colleague (in a permission group that allows draft write but not publish) attempt to publish — should be blocked.

### Dependencies

Phase 5.

---

## Phase 8 — Projects (named + optional repo linkage)

**Goal.** Owners (and authorized users) can create Projects — named work containers. Optionally link git repos to a Project for auto-detection at workflow start. Supports software-house (per-product) and agency (per-client) shapes.

### What ships (UX)

- **`/projects`** lists all Projects in the org. Active + archived filter.
- "New Project" → name, slug, description → save
- Per-Project page (`/projects/{slug}`):
  - Linked repos list (add URL manually, or accept auto-suggestions from bridge)
  - Optional `path` per repo for monorepo sub-Project scoping (e.g., `apps/web`)
  - Linked Teams list (which Teams own this Project)
  - Archive / unarchive
- Bridge integration prep: schema is ready for the auto-link suggestion that lands in Phase 11.

### Spec requirements

- `projects(id, org_id, name, slug, description, created_at, archived_at)` — slug unique per org
- `project_repos(project_id, repo_url, path)` — optional, path nullable
- `project_teams(project_id, team_id)` — many-to-many
- RLS: read open to all org members; write gated by Permission Group grant on resource type `project`

### Out of scope

- Auto-link from bridge (Phase 11 — needs bridge to run first)
- Items inside Projects (Phase 9)
- Per-Project workflows (still org-level in MSP; per-Project workflow assignment is post-launch)

### E2E acceptance criteria

1. Owner visits `/projects` → empty state with clear CTA.
2. Owner creates "Customer Portal" → appears in list.
3. Owner adds two git repo URLs (`https://github.com/acme/portal-web`, `https://github.com/acme/portal-api`).
4. Owner assigns "Engineers" Team to the Project.
5. Member with `read` on `project` sees the Project but cannot edit.
6. Archiving a Project hides it from default list view; "Show archived" reveals it.

### User-test acceptance

Owner models their actual portfolio — creates 3 real Projects, attaches the right repos and Teams. Reports whether the surface matches their mental model.

### Dependencies

Phase 5 (permissions), Phase 6 (Teams).

---

## Phase 9 — Items (Features, Bugs, Epics with hierarchy)

**Goal.** Every piece of work is an Item. Items have a type — Feature, Bug, or Epic — and live inside a Project. Epics group Features and Bugs in a two-level hierarchy.

### What ships (UX)

- **`/projects/{slug}/items`** lists all items in a Project
- Filter by type (Epic / Feature / Bug), status, owner, parent Epic
- "New Item" → type picker → title + description + optional parent Epic → save
- Per-Item page:
  - Title, description (markdown), type, status, owner, parent Epic
  - Children list (if Epic)
  - Activity / history (will fill in with agent sessions from Phase 15)
- Bulk operations: archive, reassign owner, change parent
- Type-specific extras:
  - **Bug:** severity (low / medium / high / critical), reproduction steps
  - **Feature:** user story field
  - **Epic:** child summary (X features, Y bugs, Z complete)

### Spec requirements

- `items(id, org_id, project_id, type, title, description, parent_id, status, owner_user_id, severity, user_story, created_at, archived_at)` — `type ∈ {epic, feature, bug}`
- Constraint: `parent_id` may only reference an item with `type = 'epic'`
- Constraint: items with `type = 'epic'` must have `parent_id IS NULL` (no nesting of Epics)
- Status enum: `backlog`, `in_progress`, `review`, `done`, `archived`
- RLS: read open to org members; write gated by Permission Group grant on resource type `item` (new grant type)

### Out of scope

- Agent sessions linked to Items (Phase 12)
- Custom item types (post-MSP)
- Deeper nesting (post-MSP if customers ask)
- Free-form tags (post-MSP — Projects + types + Epics give enough slicing for v1)

### E2E acceptance criteria

1. Owner creates an Epic "Q1 Onboarding."
2. Owner creates a Feature "Welcome flow" with parent = the Epic.
3. Owner creates a Bug "Signup email not sending" with severity = high, parent = the Epic.
4. Epic page shows two children with their statuses.
5. Attempting to set parent on an Epic returns a clear error.
6. Filtering items by parent Epic returns exactly those two children.

### User-test acceptance

Owner imports a real chunk of their existing backlog (manually) — at least one Epic with several Features and a Bug — and confirms the surface holds up at modest size (~20 items).

### Dependencies

Phase 5 (permissions), Phase 8 (Projects).

---

## Phase 10 — Bridge installer + pairing

**Goal.** A developer downloads the bridge installer, runs it, pairs with their org via a code, and sees their device appear in `/devices`.

### What ships (UX)

- **Bridge download page** at `app.missioncontrol.pro/install` — OS-detected primary CTA, all three platforms listed
- **Installer** for macOS (.dmg), Windows (.exe), Linux (.deb / .AppImage)
- **Tray UI** with three states: Connected (solid), Working (pulsing), Offline/Paused (outline)
- **Pairing flow**:
  - User opens tray → "Pair with org"
  - Tray opens browser → `app.missioncontrol.pro/pair?code=ABCD-1234`
  - User (already signed in) confirms in web app
  - Cloud sends a one-time pairing token to the bridge over a short-lived ephemeral WebSocket
  - Bridge persists device-bound key in OS keychain
- **`/devices`** lists every paired bridge with: hostname, OS, last seen, online state
- Revoke / rename / force-disconnect per device

### Spec requirements

- Tauri-based tray app + Node daemon (per [tech-stack.md](tech-stack.md))
- Signed installers per OS (Apple Developer ID + notarization; EV cert on Windows; GPG on Linux)
- Single-binary daemon compiled with `bun build --compile` or `pkg`
- Device keypair stored in OS-native keychain
- `devices(id, org_id, user_id, hostname, os, public_key, online, last_seen, paired_at, revoked)`
- WebSocket relay: each bridge maintains a persistent connection with TLS + JWT auth

### Out of scope

- Sync (Phase 11)
- Spawning agents (Phase 12)
- Cloud → bridge command channel (Phase 14 for decision answers; spawn-from-cloud is post-MSP, Phase 17)

### E2E acceptance criteria

**Automated (where possible):**
- Tauri build matrix produces signed artifacts for macOS, Windows, Linux on every release
- Smoke test: daemon starts, tray icon appears, exits cleanly

**User-tested (mandatory):**
- Tester downloads installer on macOS → installs → tray appears → pairs → device appears in web → signs out of bridge → device shows offline
- Same on Windows
- Same on Linux

### User-test acceptance

Three testers (one per OS) follow the install + pair flow from a written script. All three see their device in `/devices` and can revoke it.

### Dependencies

Phase 1 (auth), Phase 4 (Permission Groups — only certain groups can manage devices).

---

## Phase 11 — Bridge sync + git detection + offline-block

**Goal.** The bridge pulls workflows + standards from cloud, detects the git repo and branch when a workflow runs, offers to auto-link the repo to a Project, and refuses to operate when offline (per [Issue 12 decision](decisions/12-offline-behavior.html)).

### What ships (UX)

- Bridge syncs `workflows` + `standards` + `projects` (with their `project_repos`) from cloud at startup and on `config-changed` events
- Local SQLite cache (`~/.mcp-bridge/cache.db`)
- Signed manifest verifying the cache hasn't been tampered with
- Tray icon shows sync state — solid = synced, pulsing = syncing
- **Git detection on workflow start:**
  - Reads `.git/config` for `remote.origin.url`, current branch, last commit SHA
  - Computes ahead/behind counts vs. `main`
  - If repo URL matches a Project's `project_repos` row → session auto-attaches to that Project
  - If no match → bridge surfaces an "Attach to Project?" prompt in the next web open
- **Offline behavior**: if cloud is unreachable, tray icon goes to outline state and shows "Offline — agent disabled" message; any attempt to spawn fails with `cloud-unreachable`
- Tray has a "Pause Bridge" action so users can stop the reconnect churn during flights

### Spec requirements

- Sync protocol: `GET /api/sync` returns workflows + standards + projects the user has access to
- Realtime `config-changed` event triggers re-sync
- Bridge persists last-known cache between runs
- Online-required gate at the `spawn` and `attach` entry points (no offline queue per Issue 12)
- Git detection runs once at session start and again on every branch change (file watcher on `.git/HEAD`)
- Session events include `git_branch`, `git_commit_sha`, `git_ahead_of_main`, `git_behind_of_main`

### Out of scope

- Agent spawning (Phase 12)
- Custom workflows (post-MSP — only curated ship in v1)
- `mcp lint` CLI (Phase 12 — ships with the orchestrator skill)
- **Deployment tracking** (where + when something was deployed) — post-launch Phase 22

### E2E acceptance criteria

**Automated:**
- Integration test: change a standard via API → verify bridge cache contains the new version within N seconds
- Integration test: simulate cloud unreachable → bridge rejects spawn with `cloud-unreachable`

**User-tested:**
- Tester edits a standard in web → tray icon pulses → opens cache.db with a viewer, sees the updated body
- Tester disconnects WiFi → tray shows "Offline" → reconnects → sync resumes

### Dependencies

Phase 7 (standards), Phase 8 (Projects — for auto-link), Phase 10 (bridge can pair).

---

## Phase 12 — Curated workflow + orchestrator skill + local enforcement

**Goal.** Ship one curated workflow. Install an orchestrator skill into the user's Claude Code that enforces journaling and `decide` step usage. A developer picks an Item, runs the workflow end-to-end on their machine, and sees structured journal entries appear locally.

### What ships (UX)

- **Bridge installs the MCP orchestrator skill** into the user's Claude Code on first use (via the Claude Code plugin / skill API)
- **One curated workflow** baked into the product — e.g., `mcp-feature`, which runs braindump → research → spec → mock → plan → build → validate
- Slash command `/mcp-feature` is available in Claude Code
- **Item selection at workflow start:** the orchestrator skill asks the user which Item (Feature or Bug) they're working on — picks from the user's accessible Items in the auto-detected Project, or lets them create a new Item inline
- Each stage of the workflow:
  - Pulls the user's standards into the context packet
  - Journal write is **required** at stage entry and exit (hook-enforced)
  - `decide` step writes a `decisions.json` file the bridge watches
- Session is tagged with `item_id` so the dashboard can group by Item / Epic / Project in Phase 13
- **`mcp lint`** CLI shipped with the bridge installer for workflow authors to validate workflow files (used by us internally for now — customers can't author workflows in MSP)
- **Tray "preview dispatch"** panel — for internal validation that workflows resolve correctly

### Spec requirements

- Orchestrator skill is a Claude Code skill package, versioned, signed, distributed via the bridge
- Hook contract: `SessionStart` writes a session-start journal; `PostToolUse` writes journal events for tool calls within the orchestrator; `Stop` writes a session-end journal
- Workflow definition format (Markdown DSL with YAML frontmatter) — shipped, not user-editable in MSP
- Curated workflow assigned to "all org members" by default (we'll add Team assignment when we open custom workflow editing)
- Bridge watches `.mcp/journal/` and `.mcp/state.json` and emits journal events

### Out of scope

- Cloud streaming (Phase 11) — journals are written locally only in this phase
- Custom workflows (post-MSP)
- Workflow editor UI (post-MSP)
- Cursor integration (post-MSP, per [Issue 4 decision](decisions/04-cursor-support.html))

### E2E acceptance criteria

**Automated:**
- Integration test: spawn `claude /mcp-feature` headless → assert journal entries appear in `.mcp/journal/` for each stage entry/exit
- Lint test: known-bad workflow file fails `mcp lint` with a useful error

**User-tested (mandatory — agent runs are hard to automate fully):**
- Tester opens a test repo, runs `claude /mcp-feature` → walks through braindump → confirms each stage writes a journal entry
- Tester attempts to skip a `decide` step manually → confirms the workflow refuses to advance
- Tester examines `.mcp/state.json` after the run → state reflects what they did

### User-test acceptance

Two design partners run the curated workflow on real repos for an hour each, report that journals are written, decisions surface, and the workflow guides them through stages without breaking.

### Dependencies

Phase 9 (Items exist), Phase 11 (bridge can sync workflows + standards + projects).

---

## Phase 13 — Cloud dashboard view + live streaming

**Goal.** When an agent runs locally, the bridge streams journal entries and state diffs to cloud, and they appear in a live dashboard everyone in the org can watch. Dashboard groups by Project, filters by Item / Epic / branch.

### What ships (UX)

- Bridge streams events over the WebSocket relay (already established in Phase 10)
- **`/dashboard`** in the web app — org-wide list of agent sessions
- Each row: user, machine, **Project**, **Item title + type**, current stage, **branch** + ahead/behind main, status indicator (running / awaiting-decision / idle), last update timestamp
- Realtime updates via Supabase Realtime subscriptions
- **Item drill-down** at `/dashboard/item/{id}` — journal stream across all sessions on this item, stage timeline, current decisions, branch history
- Filter dashboard by Project, Item, Epic, owner, workflow, stage, status, branch

### Spec requirements

- `agent_sessions(id, org_id, user_id, device_id, workflow_id, workflow_version_id, item_id, stage, status, git_branch, git_commit_sha, git_ahead_of_main, git_behind_of_main, started_at, ended_at)`
- `journal_entries(id, session_id, entry_type, body, created_at)` — append-only
- Bridge event protocol: signed envelopes per [Issue 3 decision](decisions/03-security-boundary.html)
- Postgres triggers fan out to Realtime channels
- Dashboard subscribes to `agent_sessions` + `journal_entries` for the org
- "Bridge offline" badge appears next to any user whose device is offline (since we can't spawn from cloud yet — they have to start work locally)

### Out of scope

- Decision answering (Phase 14)
- Cloud → bridge spawn (post-MSP)
- Mobile push notifications (post-MSP)
- Deployment tracking ("where is this branch deployed?") — post-launch Phase 22

### E2E acceptance criteria

**Automated:**
- Integration test: run a synthetic agent on a test bridge → verify dashboard reflects each stage transition within N seconds
- Integration test: two browsers viewing the same dashboard see updates simultaneously

**User-tested:**
- Two testers in the same org — tester A runs the workflow on their machine; tester B watches the dashboard, confirms each stage advance is visible in real time

### Dependencies

Phase 12 (agent generates journals locally + sessions are tagged with item_id).

---

## Phase 14 — Web-side decision answering

**Goal.** When an agent pauses on a `decide` step, the recipient sees the decision in the web app, answers it, and the agent resumes. Closes the loop end-to-end.

### What ships (UX)

- **`/dashboard/decisions`** — inbox of open decisions assigned to the current user
- Each decision: feature, stage, question text, response UI (rendered open-ended per [Issue 7 decision](decisions/07-mobile-decision-ui.html))
- Answering posts the response → bridge picks it up → orchestrator skill reads `decisions.json` → agent resumes
- Visible to others in the org as read-only ("Maya answered this 10s ago")

### Spec requirements

- `decisions(id, session_id, recipient_user_id, recipient_team_id, kind, request_body, response_body, status, asked_at, answered_at)`
- Cloud → bridge command channel: when a decision is answered, cloud emits a signed `decision-answered` event to the originating bridge
- Bridge writes the answer to `.mcp/decisions.json`; the orchestrator skill polls (or hook-watches) and continues
- Web renders any response shape (open-ended schema per Issue 7)

### Out of scope

- Mobile push (post-MSP)
- Cloud → bridge spawn for *new* sessions (post-MSP)

### E2E acceptance criteria

**Automated:**
- Integration test: agent pauses → decision row created → user posts response via API → bridge receives event → agent unblocks

**User-tested (the demo):**
- Tester A runs the workflow locally; it pauses on a decision
- Tester B (anywhere with web access, signed in to the org) sees the decision in `/dashboard/decisions`, picks an option, submits
- Tester A's agent receives the decision within seconds and continues to the next stage
- This is the **first true end-to-end loop** — script and demo it; this is what's shown to design partners

### Dependencies

Phase 13.

---

## ━━━━━━━━━━━━━━━━ MSP CUTOFF ━━━━━━━━━━━━━━━━

After Phase 14, the product can be sold to design partners or paying alpha customers. Phase 15 makes it sellable to the open market.

---

## Phase 15 — Billing + plan limits

**Goal.** Visitors can pay for a Team plan. Free tier is enforced (solo only). Existing orgs can upgrade.

### What ships (UX)

- **Pricing page** added to the marketing site (using the structure from [pitch-deck.html](pitch-deck.html))
- Sign-up flow extended: after creating an org, choose Free or Team
- Team flow → Stripe Checkout → returns to onboarding
- **`/settings/billing`** in the web app — current plan, seat count, "Manage in Stripe" button (deep link to Customer Portal)
- **Free tier enforcement**: invite flow blocks if seat count would exceed plan limit (Free = 1)
- Plan info visible on `/people/users` (X of N seats used)

### Spec requirements

- `subscriptions(org_id, stripe_subscription_id, plan, seat_count, status, current_period_end)`
- Stripe Checkout for new Team subscriptions
- Stripe Customer Portal for changes (link, not embedded)
- Webhook → Edge Function → updates `subscriptions` table
- Seat enforcement at invite time (block if `(active_users + pending_invites) >= seat_count`)
- Trial logic — decision pending (lean: no separate trial; Free is the always-on lower tier)

### Out of scope

- Usage-based billing (per [Issue 9 decision](decisions/09-pricing-structure.html))
- Annual prepay vs monthly (ship both at once)
- Enterprise self-serve (Enterprise = contact sales)

### E2E acceptance criteria

**Automated:**
- Stripe test mode: end-to-end signup + checkout + webhook → org reaches Team status
- Free org cannot invite a 2nd user; attempt returns useful error

**User-tested:**
- New visitor signs up, picks Team, completes Stripe checkout (test card), lands on dashboard with Team status
- Free org owner tries to invite — sees clear upgrade prompt

### Dependencies

Phase 3 (invitations are seat-counted).

---

## Phase 16 — GA polish

**Goal.** Cold visitors can flow from marketing landing to running their first agent without support intervention.

### What ships (UX)

- **Status page** (statuspage.io or self-host) — uptime, current incidents
- **Security page** at `/security` on marketing site (per [briefs/01-marketing-site.md](briefs/01-marketing-site.md))
- **Docs** at `/docs` — getting started, install, first workflow, troubleshooting
- **Onboarding refinements**: progress checklist on the dashboard ("Install your bridge" → "Run your first workflow" → "Watch it in the dashboard")
- **Empty states** across all surfaces with clear next-action links
- **Bridge offline UX** polished in dashboard — clearer messaging about why Start isn't available yet (still no cloud → bridge spawn until post-MSP)
- **Final pass on all global styles** — IMPACT font + black/white tone consistent across every screen

### Spec requirements

- Status page integration with health endpoints (`/api/health`, bridge relay health)
- Docs site (MDX in the Astro project)
- Onboarding checklist driven by `org_members.onboarding_steps_completed` JSONB
- Sentry / equivalent error reporting tied in

### Out of scope

- Marketing campaigns (separate team)
- Customer support tooling (Intercom, Linear, etc.)

### E2E acceptance criteria

**User-tested (the canonical cold-visitor flow):**
- Tester who has never used MCP visits the marketing site → signs up → invites a teammate → installs bridge → runs curated workflow → teammate watches in dashboard → answers a decision → agent finishes
- Tester completes this in under 30 minutes with no help and reports any friction in writing

### Dependencies

Phases 1–15.

---

## Post-launch roadmap (sequenced, not gating)

These ship after MSP launch. Order driven by customer feedback, not by this doc.

### Phase 17 — Cloud → bridge spawn ("Start" from dashboard)

The three-state Start button from [Issue 1](decisions/01-bridge-install-gate.html). Cloud emits signed `spawn-session` events to bridges. Big quality-of-life jump.

### Phase 18 — Custom workflows (workflow editor)

Workflow markdown editor in the web app. `mcp lint` becomes a customer-facing tool. Linear history + drafts per [Issue 6 decision](decisions/06-version-control-scope.html). Workflow assignment to users + Teams.

### Phase 19 — Mobile apps (iOS / Android)

Decision inbox + answer flow. Expo Push. Personal-only. Per [briefs/04-mobile-apps.md](briefs/04-mobile-apps.md).

### Phase 20 — Cursor support

`AgentAdapter` interface gets a Cursor implementation. Per [Issue 4 decision](decisions/04-cursor-support.html), only when a design-partner team formally blocks on it.

### Phase 21 — Enterprise tier features

SSO/SAML, audit log export, self-hosted bridge fleet, telemetry opt-out enforcement at the network layer.

### Phase 22 — Deployment tracking

CI webhook integration. Branches gain deployment markers ("deployed to staging from `feature/x` at `2026-08-12T14:22Z`"). Dashboard answers "where is this running?" — the missing half of branch tracking from MSP. GitHub Actions / GitLab CI / generic webhook adapters.

### Phase 23+ — TBD

UI primitives library (if customers ask), templates marketplace, integrations (Linear, Jira, GitHub items sync), Web Push, expanded curated workflow library, free-form tags on Items, deeper hierarchy if customers ask.

---

## Things this plan deliberately does NOT include in MSP

For clarity — anything below was considered and chose to ship later:

- **Custom workflows.** MSP ships curated only. The workflow editor is a real product surface and gets its own phase.
- **Mobile apps.** Designed and specced, but not in MSP.
- **Cloud → bridge spawn.** Dashboard is view-only at MSP. Users start agents locally with `claude /mcp-feature`.
- **Cursor support.** Claude-only at MSP.
- **UI primitives library.** Deferred entirely; standards cover the use case.
- **Telemetry default-on.** Opt-in only.
- **SSO / SAML.** Enterprise tier post-MSP.
- **Web push for browsers.** No real value over the in-browser realtime dashboard.
- **Comments on workflows / standards.** v2.
- **Branching for workflows / standards.** v2.

---

## How to use this document

- **Before each phase starts**: confirm the spec section is current. Update if anything has drifted.
- **During each phase**: every PR references the phase number in its title (`[P7] add standards diff view`).
- **At each phase end**: the e2e acceptance criteria run green AND a real user completes the user-test script. Only then does the next phase start.
- **If a phase splits**: number with a letter (Phase 10a, 10b). Don't quietly grow Phase 10 — split it.

---

## Open questions before Phase 1 starts

1. **Marketing copy.** Hero / subtext aren't drafted. Who owns?
2. **Domain.** Is `missioncontrol.pro` registered? If not, fallback?
3. **Org slug uniqueness.** Globally unique or per-tenant? Lean: globally unique (used in URLs).
4. **Sign-up email verification — required or optional?** Lean: required, but with a 7-day grace period before account is locked.
5. **Curated workflow choice for Phase 12.** Which workflow do we ship first? Suggestion: a single feature-development workflow (`mcp-feature`) that does braindump → spec → plan → build → validate. Confirm.
