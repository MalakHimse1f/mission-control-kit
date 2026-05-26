# Requirements Analysis — Flaws, Risks, and Open Questions

**Last updated:** 2026-05-26
**Status:** Draft v0 — for discussion before building

This document goes through the requirements you laid out and surfaces the parts that are technically hard, ambiguous, or that I think will hurt us if we don't decide them now. The goal isn't to talk you out of anything — it's to make sure every choice is intentional.

I've grouped issues by severity:

- 🔴 **Blocker** — must be resolved before any code is written.
- 🟠 **High** — must be resolved before the related surface ships.
- 🟡 **Medium** — worth deciding early, but can be deferred.

---

## Decision summary

**All 11 open issues are resolved or deferred as of 2026-05-26.** Detailed reasoning per issue lives below the summary.

| # | Issue | Status | Outcome |
|---|---|---|---|
| 01 | Bridge install / Start when offline | ✅ Decided | Path C — hybrid three-state Start button (online / sleeping / not-installed) |
| 02 | Claude Code visibility surface | ✅ Resolved | Journal-driven model — only orchestrator/subagent journal writes flow to cloud |
| 03 | Security boundary | ✅ Decided | Path C — defense in depth (signed envelopes + allowlist + consent + kill switch + audit) |
| 04 | Cursor support | ✅ Decided | Path A — Claude-only v1 with `AgentAdapter` interface designed in |
| 05 | Permission Groups + workflow assignment | ✅ Decided | Permission Groups = single-membership, govern CRUD on org config. Workflows assign to **Teams** (separate concept). Union model for Teams. **Terminology corrected — see full entry below.** |
| 06 | Version control scope | ✅ Decided | Linear history + one draft per author |
| 07 | Mobile decision UI | ✅ Decided | Path B — render anything; long/complex decisions can be reviewed on web or local machine |
| 08 | Transcript privacy | ✅ Resolved | Subsumed by journal-driven model (#2) |
| 09 | Pricing structure | ✅ Decided | Path A — per-seat with Free / Team / Enterprise; Free is solo-user only |
| 10 | UI primitives scope | ⏸ Deferred | Out of v1 scope. Reopen post-launch if customers ask. |
| 11 | Workflow author iteration | ✅ Decided | Path B — `mcp lint` CLI + bridge tray "preview dispatch" |
| 12 | Offline bridge behavior | ✅ Decided | Path B — block agent when offline; cloud-visibility is a hard requirement |
| 13 | Telemetry posture | ✅ Decided | Path B — opt-in only; no telemetry by default |

---

## Already resolved

### Visibility model: journal-driven, not transcript-driven

**Decision (2026-05-26):** The cloud does **not** mirror the agent's free-form chat. The only events that flow to the cloud are **journal entries explicitly written by the orchestrator skill and subagents** — plus structured decision requests that pause the agent and require a user response.

**Implications:**

- The bridge protocol carries **journal events**, **state diffs**, and **decision requests** — not transcript chunks.
- Our **hooks must be robust and unbypassable**. They are the contract that "important things were journaled." If a subagent forgets to journal, the cloud doesn't know it happened.
- Every workflow step that needs user input must use the `decide` step type. The decide step triggers a structured notification (web + mobile) with response options. Free-form "I have a question" mid-stream is not visible to the cloud.
- This resolves Issue 2 (Claude Code visibility surface) and Issue 8 (what gets sent to cloud) as previously written. Both are removed from the live list below.

### Terminology correction: Permission Groups ≠ Teams

**Decision (2026-05-26):** Two separate concepts, previously conflated in the docs:

| Concept | Membership | Purpose |
|---|---|---|
| **Permission Group** | Each user is in **exactly one** | Governs CRUD access to org config — workflows, standards, invitations, devices, billing |
| **Team** | A user can be in **many** | Groups workflows to roles (Designers, Engineers, PMs); used for workflow assignment only |

A Permission Group does **not** affect how an agent is directed. A Team does **not** affect whether the user can edit org settings. They are independent axes. All documentation has been updated to use this terminology consistently.

### Issue 05 resolutions

- **Permission Groups precedence:** N/A. Each user is in exactly one Permission Group. No precedence question.
- **Workflow assignment precedence:** A user sees the **union** of workflows assigned to them directly OR to any Team they're in. When more than one workflow matches a task type at dispatch, the orchestrator picks the one marked `default: true` for that team; if no default, it surfaces a `decide` step.

### Projects, Items, Hierarchy, Branch tracking (resolved 2026-05-26)

Four concepts that were missing from the original spec — flagged in review, decided in writing:

**Projects (Decision 14).** A Project is a named work container with an optional array of associated git repo URLs. Bridge auto-detects via `.git/config` and offers to link the repo to the matching Project on first workflow run. Supports monorepos (path-scoped sub-Projects on one repo) and multi-platform Projects (one Project linked to many repos). Default UX is naming a Project; git linkage is a power feature. Software houses get clean per-product Projects; agencies get clean per-client Projects.

**Items (Decision 15).** One `items` table with a `type` discriminator: `feature`, `bug`, `epic`. Type-specific UX (bug severity, feature user stories, epic child list) layered on a shared shape. Replaces the prior implicit "feature" concept everywhere. Future types (`spike`, `task`, `research`) drop in without schema changes.

**Hierarchy (Decision 16).** Two-level: an Epic can be the parent of Features and Bugs. Epics cannot be parents of Epics. Features and Bugs cannot have children. Enforced at the app layer via constraints on `items.parent_id`. Covers ~95% of real cases (familiar Jira/Linear shape); deeper nesting is a post-launch consideration if customers ask.

**Branch tracking (Decision 17).** Bridge reads `.git/config` on session start and reports: current branch, last commit SHA, ahead-of-main count, behind-of-main count. Dashboard shows it per session. **Deployment tracking** (where + when was this deployed) is deferred to a post-launch phase with CI webhook integration — out of MSP.

**Schema implications:**

- New table: `projects(id, org_id, name, slug, description, created_at, archived_at)`
- New table: `project_repos(project_id, repo_url, path)` — `path` is optional, used for monorepo sub-Project scoping
- New table: `project_teams(project_id, team_id)` — Teams optionally assigned to Projects
- New table: `items(id, org_id, project_id, type, title, description, parent_id, status, owner_user_id, created_at, archived_at)` — `type ∈ {epic, feature, bug}`
- Constraint: `parent_id` may only reference an item with `type = 'epic'`
- Constraint: items with `type = 'epic'` must have `parent_id IS NULL`
- `agent_sessions` gains: `item_id` (FK), `git_branch`, `git_commit_sha`, `git_ahead_of_main`, `git_behind_of_main`
- The `feature_slug` field on `agent_sessions` is removed — replaced by `item_id`

**Shipping plan impact:** two new phases inserted (Projects becomes Phase 8, Items becomes Phase 9); the bridge and dashboard phases shift up by two. Deployment tracking joins the post-launch roadmap. See [shipping-plan.md](shipping-plan.md) for the renumbered sequence.

---

## 🔴 Blockers — decide before writing code

### 1. "Start a local session from the cloud" depends on a daemon being installed and running — ✅ Decided · Path C

**The requirement:** Click "Start" on a feature card in the web dashboard → a Claude Code or Cursor session opens on the user's machine.

**The reality:** Neither Claude Code nor Cursor exposes a remote-trigger API. Cloud-to-machine activation requires our **bridge daemon** to be installed, running, and logged in. If it isn't running, the click does nothing.

**Implications:**

- We need a robust install + first-run flow (system tray icon, "ready" indicator).
- The web dashboard needs a clear "bridge offline" state — what happens when a user taps Start and their bridge is asleep?
- Auto-launching the daemon at login is mandatory. macOS LaunchAgents, Windows Startup, systemd user units.
- For shared dev machines or VDI, "which device gets the spawn" needs disambiguation. Lean: bridge devices are named, the user picks a device on Start.

**Recommendation:** make device registration and bridge presence a **first-class concept** in the data model from day one. A feature can only be "Started" against a registered, online device.

**Decision (2026-05-26):** Path C — three-state Start button. Bridge online → instant launch. Bridge sleeping → wake-via-push button. Bridge not installed → install CTA. The data model needs `devices.online`, `devices.last_seen`, and `devices.wake_endpoint`; the web app subscribes to `devices` realtime so button state updates without reload.

---

### 2. Claude Code's extension surface limits what we can really see — ✅ resolved (journal-driven model)

**The requirement:** Cloud routes interactions, sees agent progress in real time, dashboard shows what every agent is doing.

**The reality:** Claude Code exposes:

- **Slash commands** (we can ship `/mcp-start`, `/mcp-next`, etc.).
- **Hooks** (`SessionStart`, `PreToolUse`, `PostToolUse`, `Stop`, `UserPromptSubmit`, etc.).
- **Skills** (we can install org skills via plugin).
- **Settings/permissions** (we can configure).

It does **not** expose:

- A way to read the live transcript from outside the process.
- A way to inject a user message from outside (no remote "type this prompt").
- A way to enumerate active sessions across the OS.

**What this means for the product:**

- We can capture **structured events** (hook fires, tool calls, journal writes the orchestrator skill produces).
- We **cannot** mirror the full chat transcript to the cloud unless our orchestrator skill explicitly journals it.
- "Answer from mobile" works only when the agent is *waiting on a structured decision we defined* (a `/mcp-decide` step in the workflow), not on a free-form chat turn.

**Recommendation:** ship a clearly-bounded interaction model. Free-form chat stays in the IDE. Structured decisions (the orchestrator pauses at a defined gate) are what the web + mobile surfaces can answer. This is actually a *feature* — it makes the experience legible, not chaotic.

---

### 3. Security boundary — cloud can spawn local commands — ✅ Decided · Path C

**The requirement:** Cloud sends `spawn-session` events that cause local processes to start.

**The risk:** If the cloud (or a stolen token) can tell the bridge to run arbitrary commands, we are a remote code execution vector. This is the most attractive attack surface in the whole product.

**Required mitigations (all of these, not pick one):**

1. **Signed event envelopes.** Each command signed by the cloud's private key; the bridge holds the public key and verifies.
2. **Allowlist of spawnable commands.** The bridge only spawns specific binaries (`claude`, `cursor`, our helper scripts), with specific argument shapes. No "run arbitrary command" channel ever.
3. **User-confirm on first run per workspace.** First time a workspace is targeted from cloud, system tray prompts the user. Trust persists until revoked.
4. **Kill switch.** Org admin can revoke a device or a session globally from the web app.
5. **Audit log of every spawn.** Append-only, visible to org admins.

**Recommendation:** treat the bridge protocol as a security product from day one. Threat model written before protocol implementation.

**Decision (2026-05-26):** Path C — defense in depth. All five mitigations are required, not optional. Spawn allowlist is compiled in (not configurable from cloud). Workspace consent persists in the bridge's local SQLite. Threat model document required before protocol implementation begins.

---

## 🟠 High — decide before the relevant surface ships

### 4. Cursor support roughly doubles bridge integration cost — ✅ Decided · Path A

You said "or descope to only Claude if that makes things simpler." It does. Considerably.

| | Claude Code | Cursor |
|---|---|---|
| Hooks | Documented, stable | Less mature, less coverage |
| Skills/plugins | Mature plugin system | Different extension model |
| Headless invocation | `claude` CLI is straightforward | Cursor is GUI-first |
| Subagents | First-class | Less structured |

Supporting both means:

- Two integration shims in the bridge.
- Two sets of hooks to keep in sync.
- Two slash command sets to ship and update.
- Two failure modes to debug for support tickets.

**Recommendation:** ship Claude Code-only for v1. Frame it externally as "Claude-first" so the addition of Cursor later is a feature launch, not a fix. Add Cursor when a design-partner team formally blocks on it.

**Decision (2026-05-26):** Path A — Claude Code-only for v1. Bridge core speaks to an `AgentAdapter` interface so Cursor can land as a drop-in adapter in v2 without core changes. Interface methods: `spawn(workspace, command)`, `installHooks()`, `onJournalWrite(callback)`, `signalDecision(decision)`.

---

### 5. Permission Groups + workflow assignment — ✅ Decided (terminology corrected)

**Original framing (now superseded):** I had conflated two separate concepts — permission groups (CRUD on org config) with the grouping used to assign workflows to roles like designers / engineers / PMs.

**The correction (2026-05-26):**

| Concept | Membership | Purpose |
|---|---|---|
| **Permission Group** | Each user is in **exactly one** | Governs CRUD on org config — workflows, standards, invitations, devices, billing. Owner / Admin are system groups; custom groups can be added. |
| **Team** | A user can be in **many** | Groups users for workflow assignment — Designers, Engineers, PMs. Has nothing to do with edit access. |

**Resolution:**

- **Permission Groups precedence:** N/A. Single membership eliminates the question entirely.
- **Workflow assignment precedence:** Union — a user sees every workflow assigned to them OR to any Team they belong to. Workflows can be marked `default: true` per team for dispatch tiebreak; if no default and multiple match, the orchestrator emits a `decide` step asking the user.

**Schema implication:** `org_members.permission_group_id` is a foreign key (one per user, not null). `team_members` is a many-to-many join table. `workflow_assignments` references `user_id` or `team_id` (never `permission_group_id`).

All documentation has been updated to use this terminology.

---

### 6. Version control "everything" is broader than it sounds — ✅ Decided · Linear + drafts

**The requirement:** Version control workflows, standards, primitives — probably more.

**Open questions:**

- **Branches?** Or linear history with revert?
- **Drafts?** Can someone edit a workflow without immediately affecting all assigned devs?
- **Diff view?** Markdown side-by-side is fine for v1; structured diffs for UI primitives may need design.
- **Rollback?** If we roll back a workflow, in-flight agent sessions using the newer version — what do they do?
- **Comment / review?** Or just history with commit messages?

**Recommendation v1:**

- Linear history. Every save is a new version. Parent pointer for the immediate previous version. No branches.
- Drafts: yes, but only one draft per workflow per user. Publishing replaces head.
- Diff view: side-by-side markdown. Good enough.
- Rollback: publish a previous version as the new head (new row, points back). In-flight sessions finish on the version they started with.
- Comments: v2.

**Decision (2026-05-26):** Confirmed — linear history + one draft per author per workflow. Schema: `workflows(id, slug, current_version_id)` + `workflow_versions(id, parent_id, body, author_id, published_at, is_head)` + `workflow_drafts(workflow_id, author_id, body, base_version_id)`. Unique constraint on `workflow_drafts(workflow_id, author_id)`. In-flight agent sessions pin to `version_id` at start.

---

### 7. Mobile "respond with structure" — ✅ Decided · Render anything

**The requirement:** Mobile receives notifications from local agents and responds "with structure."

**The flaw:** "With structure" is doing a lot of work in that sentence. There's a wide range of structured responses:

| Type | Mobile-friendly? | v1? |
|---|---|---|
| Approve / reject | ✅ Trivial | Yes |
| Pick one of N options | ✅ Easy | Yes |
| Pick many of N options | 🟡 OK | Yes |
| Short text answer | 🟡 OK on phone | Yes |
| Long-form PRD review | ❌ Painful | No — link out to web |
| Code diff review | ❌ Not realistic | No — link out to web |
| File picker | ❌ Can't | No |

**Recommendation:** define a **decision schema** with a fixed set of response types. The workflow author chooses one when they write the step. Mobile renders any decision whose type is in the mobile-friendly column above; everything else shows "Open in web app."

**Decision (2026-05-26):** Path B — render anything. Workflow authors can specify any response shape they want; mobile renders it best-effort. If a user prefers to review long content on a bigger screen, they can switch to web or local at any time. Mobile defaults to one-shot rendering rather than gating step types.

**Implication:** the schema must be open-shaped (extensible step types) rather than a closed enum. Mobile renderers degrade gracefully — large bodies use scrollable views; unknown shapes fall back to "Open externally" link without blocking. The cost of this choice is occasional poor-mobile UX; the benefit is no author hitting a wall.

---

### 8. The agent transcript probably contains sensitive code — ✅ resolved (journal-only, skill-controlled)

**The risk:** Even an orchestrator-skill-only model means we're sending journal entries, decision context, and stage summaries to the cloud. If a journal entry includes a code snippet from a private repo, that snippet now lives in Supabase.

**Required clarity:**

- What exactly is the bridge allowed to send? (Lean: structured events from the orchestrator skill only. Never raw transcript. Never file contents unless the skill author explicitly attaches them.)
- Where is "what gets sent" defined? (Lean: in the workflow DSL, per step.)
- How is it stored at rest? (Supabase encrypts at rest; we add row-level encryption for journal content as a v2.)
- Can a customer turn off cloud journal entirely? (Lean: yes — "metadata-only" mode that ships agent stage + decisions but not journal bodies. Enterprise tier feature.)

---

## 🟡 Medium — worth deciding, can defer

### 9. Pricing structure — ✅ Decided · Path A

You haven't specified pricing. I sketched per-seat in the pitch deck. The hard questions:

- **Who counts as a seat?** Anyone with an account, or only people with a bridge installed? My lean: anyone with an account, because PMs/designers will have accounts but no bridge.
- **Free tier:** is there one? My lean: yes, single-user, single-workflow, no cloud sync — a funnel into Team.
- **Usage caps:** do we cap journal volume, agent sessions, devices per seat? My lean: soft caps at first, real caps only if we see abuse.

**Decision (2026-05-26):** Path A — per-seat with Free / Team / Enterprise. **Free tier is solo-user only** (one user in the org, no teammates, no cloud-shared workflows). Team tier ~$30/seat/mo; any account in an org counts as a seat. Enterprise is custom. Stripe Customer Portal handles plan + seat management. Seat enforcement happens at invite time.

### 10. "Org-level UI primitives" — ⏸ Deferred (not in v1)

Listed as "?". That's the right instinct — this could be anything from "a markdown doc describing button styles" to "a generated component library." For v1, I'd suggest:

- **Storage:** versioned text + uploadable images (Figma exports, screenshots).
- **Surface:** the workflow editor can reference primitives by ID; bridge pulls primitive docs into context packets at dispatch.
- **Out of scope v1:** generating actual component code, design-token sync to Figma, runtime style enforcement.

**Decision (2026-05-26):** **Deferred.** UI primitives are not necessary for v1. Standards documents (markdown) cover the same intent — authors can write a "UI standards" markdown describing tokens, primitives, dos & don'ts, and the bridge pulls it into context packets just like any other standard. Reopen this only if customers explicitly ask for a structured primitives library.

**Action:** remove UI primitives from the v1 data model, the web app brief, and the pitch deck's "what the org owns" surface. They become a future feature listed in the roadmap.

### 11. Local dev experience for workflow authors — ✅ Decided · Path B

If workflows are edited in the cloud only, the feedback loop for a workflow author is slow (edit → save → sync → test in a real agent). We should consider:

- **CLI "linter"** that validates a workflow document against the DSL schema.
- **Local preview** in the bridge tray UI: "What would dispatch look like if I started feature X with this workflow?"
- **Workflow templates** copied from a vetted starter set.

None of this needs to be in v1, but a workflow editor with *no* local preview will frustrate the people who become our champions.

**Decision (2026-05-26):** Path B — ship `mcp lint` CLI alongside the bridge installer for schema validation, and a bridge tray "preview dispatch" panel that builds and prints the context packet without invoking Claude. `mcp lint` uses `@mcp/schema` (same Zod schemas as bridge and web). CLI does NOT include cloud sync in v1 (`mcp pull` / `mcp push` are explicitly v2).

### 12. Offline behavior of the bridge — ✅ Decided · Path B (Block when offline)

What happens when the dev's laptop is offline (or the relay is down)?

- **Local agent:** keeps running. The agent doesn't depend on the cloud at all.
- **Bridge:** queues events to disk. Reconciles when the connection returns.
- **Cloud dashboard:** marks the device "offline" but the last-known session state stays.
- **Conflict resolution:** if a workflow was edited in the cloud while the dev was offline, the bridge applies the update on reconnect. In-flight session keeps using the version it started with.

This is mostly straightforward, but it needs to be a written design before we ship.

**Decision (2026-05-26):** Path B — block the agent when offline. Cloud visibility is a hard product requirement; we don't tolerate "agents working invisibly." The bridge refuses to spawn or attach if it can't reach the cloud, with a clear tray message. This is intentionally stricter than what most local-first tools do — it's a deliberate trade against developer convenience for organizational visibility.

**Tradeoffs to plan for:**

- Cloud uptime is now load-bearing for every paying customer's dev productivity. Status page + clear incident comms become a must.
- "Working offline" is a non-feature. Marketing should not promise it. The tray should explain clearly.
- Long flights, café WiFi drops, and VPN flaps will all surface as user complaints. Documentation should explain how to "stand down" the bridge during these periods so it doesn't keep retrying.

### 13. Telemetry vs. customer privacy — ✅ Decided · Path B (Opt-in only)

We will want product telemetry (which workflow templates are popular, where users drop off in setup). Customers will want to opt out. Decide the default and surface it:

- **Default:** anonymized usage telemetry on, content telemetry off.
- **Opt-out:** one toggle per org. Self-host doesn't send any.

**Decision (2026-05-26):** Path B — opt-in only. Nothing leaves customer environments unless explicitly enabled. Settings show a clear "Send anonymous usage data" toggle (default off). Content telemetry never exists, regardless of toggle state.

**Tradeoffs to plan for:**

- We'll have very little data about how the product is used in the wild. Onboarding optimization, funnel analysis, and feature usage have to come from design partners + sales conversations, not telemetry.
- Public telemetry catalog (docs page listing every event we'd capture if opted in) still ships — it's a trust signal even when off by default.
- Build the telemetry infrastructure now (Edge Function endpoint, schema) so opting in is a flip, not a sprint.

---

## Things you said that I want to double-check I understood

These aren't flaws — they're places I want to confirm my reading before designing around them:

1. **"WE DO NOT OWN THE AGENTS"** — I read this as: we never ship our own coding agent. We never call Claude/Anthropic APIs directly with our own keys for code generation. The user's agent uses the user's account/credits, always. Confirm.
2. **"iOS/Android apps do not allow for org-level controls"** — mobile is a personal-decision-answering surface only. No workflow editing, no permissions admin, no Start-from-mobile (or *is* Start-from-mobile OK)? Need to confirm: is Start-from-mobile in or out?
3. **"User agent orchestration" and "Org-level agent orchestration"** — I'm reading "user agent orchestration" as the existing v5 behavior (orchestrator dispatches subagents on the user's machine) and "org-level orchestration" as the new cloud-side dashboard view over all those sessions. Confirm we're not also implying a *cross-user* orchestrator that assigns work between humans — that's a project-management product, not this product.
4. **"Routing and workflows" vs. "Standards"** — I've treated these as separate first-class entities (workflows = the sequence of stages, standards = the constraints applied across all stages). The pitch and tech-stack docs reflect that split. Confirm.

---

## Recommended next moves

1. Lock decisions on items **1–3** (the blockers) before any implementation starts.
2. Decide Cursor vs. Claude-only (item 4) — this halves bridge scope.
3. Write the **bridge protocol spec** as its own short document. It's the load-bearing piece of the whole system.
4. Pick the **3 design-partner orgs** mentioned in the pitch deck and validate items 5, 7, 8 with them before locking the data model.
