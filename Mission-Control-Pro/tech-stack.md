# Mission Control Pro — Tech Stack

**Last updated:** 2026-05-26
**Status:** Draft v0 — for feedback

This document fixes the technology choices for each surface of Mission Control Pro. The bias is toward **boring, well-supported tools** so we spend our innovation budget on the product (workflow editor, dashboard, bridge protocol), not the platform.

---

## Guiding principles

1. **One platform for backend services.** Supabase covers auth, Postgres, storage, realtime, and Edge Functions. Picking it once removes a lot of glue code.
2. **Local execution stays local.** Customer source code never leaves the dev's machine unless they explicitly route something to the cloud (a journal line, a diff snippet). The bridge controls what leaves.
3. **Each surface ships independently.** Marketing site, web app, bridge, and mobile app each have their own repo (or workspace) and their own deploy pipeline. They share types via a published `@mcp/types` package.
4. **Version everything that's editable.** Workflows and standards live as text in the DB with a change-log table. Any "edit" is a new version with a parent pointer.
5. **TypeScript end-to-end.** Web, bridge, and mobile all in TS. Shared schema via Zod.

---

## Per-surface stack

### Cloud platform (shared backend)

| Concern | Choice | Notes |
|---|---|---|
| Auth | **Supabase Auth** | Email/password v1. Google OAuth v1. SSO (SAML) gated to Enterprise tier. |
| Database | **Supabase Postgres** | Row-level security (RLS) for org isolation. |
| File storage | **Supabase Storage** | For uploaded assets — standards attachments, exported logs. |
| Realtime | **Supabase Realtime (Postgres replication)** | Web dashboard subscribes to agent status changes. |
| Background jobs | **Supabase Edge Functions** (Deno) | Webhook handlers (Stripe), digest emails, cleanup. |
| Bridge ↔ Cloud transport | **WebSocket via dedicated relay** | Not Supabase Realtime — we need bidirectional command channel with custom auth/signing. See [`briefs/03-local-router.md`](briefs/03-local-router.md). |
| Payments | **Stripe** | Stripe Checkout for self-serve, Customer Portal for plan/seat management, webhooks → Edge Function. |
| Email | **Resend** | Transactional only (verify, invite, digest). |
| Object/Log archive | **Supabase Storage** (v1) → S3-compatible (v2 if cost requires) | Journal lines older than 30 days move to cold storage. |

### Surface 1 — Marketing & Payment Site

| Concern | Choice |
|---|---|
| Framework | **Astro** (static-first, MDX content) |
| Styling | Tailwind CSS |
| Forms | Astro + Supabase Edge Function endpoints |
| Payment | Stripe Checkout (hosted) |
| Hosting | Vercel or Cloudflare Pages |
| Analytics | Plausible (self-host or hosted) |

**Why Astro and not Next.js:** marketing pages are 95% static content. Astro ships less JS, indexes better for SEO, and lets the team move faster on copy iteration. We do not need the same framework as the web app.

### Surface 2 — Web App (Org Control)

| Concern | Choice |
|---|---|
| Framework | **Next.js 15 (App Router) + React Server Components** |
| Language | TypeScript |
| Styling | Tailwind + shadcn/ui (primitives) |
| State | Server components + URL state. React Query for the few client islands. |
| Forms / validation | React Hook Form + Zod (shared schemas with backend) |
| Markdown / DSL editor | Monaco for code blocks, TipTap for prose, custom DSL renderer for workflow steps |
| Realtime UI | Supabase Realtime client subscriptions |
| Charts | Recharts (only if needed v1) |
| Hosting | Vercel |

### Surface 3 — Local Router (Bridge)

| Concern | Choice |
|---|---|
| Runtime | **Node.js LTS** (single-binary build via `pkg` or `bun build --compile`) |
| Process model | Daemon + small system tray UI |
| Tray UI | **Tauri** (macOS, Windows, Linux) — lighter than Electron |
| IPC tray ↔ daemon | Unix socket / named pipe |
| Cloud transport | WebSocket (`ws` library) over TLS, with signed event envelopes |
| File watching | Chokidar |
| Agent spawning | Node `child_process` — launches `claude` CLI |
| Local cache | SQLite via better-sqlite3 (workflows, standards, signed manifest) |
| Updates | Self-update via signed release artifacts pulled from cloud |
| Auth | Device-bound token (per-install) + org-scoped JWT refresh |

**Why Tauri over Electron:** ~40MB install vs. ~150MB, native webview, much smaller memory footprint for a tray app. The daemon itself doesn't need a webview at all — it's a pure Node process. Tauri only renders the tray menu / settings popover.

**Why Node and not Go/Rust for the daemon:** the agent integration shells out to Claude Code and Cursor (both Node-friendly), TypeScript types are shared with the rest of the stack, and contributor velocity is highest in Node. We may rewrite the daemon in Go if we hit performance walls.

### Surface 4 — Mobile (iOS / Android)

| Concern | Choice |
|---|---|
| Framework | **React Native via Expo** |
| Language | TypeScript |
| Push | Expo Push (wraps APNs + FCM) for v1; direct APNs/FCM if Expo doesn't fit |
| Build / OTA | EAS Build + EAS Update |
| State | Zustand or React Query (no need for Redux) |
| Auth | Supabase Auth via expo-auth-session |
| Deep links | Universal Links (iOS) + App Links (Android) for "open this decision" |

**Why Expo:** one codebase, OTA updates without app-store cycles, push notifications already wrapped, easier hiring. The app is small in scope (notifications + answer flow) so we don't need bare React Native.

---

## Shared packages (monorepo)

We'll use a pnpm workspace with these shared packages:

| Package | Purpose |
|---|---|
| `@mcp/types` | Shared TypeScript types (DB rows, API contracts) |
| `@mcp/schema` | Zod schemas for workflows, standards, events |
| `@mcp/protocol` | Bridge ↔ cloud event envelope shape + signing |
| `@mcp/workflow-dsl` | Parse/serialize workflow definitions (used by web editor + bridge) |
| `@mcp/ui` | Shared React components (web app + marketing) |

---

## Data model — top-level tables

These are the cloud Postgres tables that drive the product. RLS policies enforce org isolation everywhere.

| Table | Purpose |
|---|---|
| `orgs` | Top-level tenant |
| `users` | Account record (Supabase auth link) |
| `org_members` | User ↔ org. Has `permission_group_id` (FK, NOT NULL — each user is in exactly one Permission Group) |
| `permission_groups` | System (Owner, Admin, Member) + custom. Governs CRUD on org config — **not** workflow routing |
| `permission_grants` | `permission_group_id` ↔ resource_type ↔ resource_id ↔ action |
| `teams` | Workflow grouping (Designers, Engineers, PMs). Independent of Permission Groups |
| `team_members` | User ↔ team (many-to-many) |
| `projects` | Named work container (name, slug, description). Optional repo linkage via `project_repos`. Software-house: per-product. Agency: per-client. |
| `project_repos` | `project_id, repo_url, path` — optional. `path` enables monorepo sub-Project scoping. |
| `project_teams` | `project_id, team_id` — Teams optionally assigned to Projects (many-to-many) |
| `items` | Generic work items. `type ∈ {epic, feature, bug}`. Fields: `org_id, project_id, type, title, description, parent_id, status, owner_user_id`. Constraint: `parent_id` only valid when target is type=epic; epics cannot have parents. |
| `workflows` | Workflow head (name, slug, current version) |
| `workflow_versions` | Immutable versions with parent pointer |
| `workflow_drafts` | One per (workflow, author). Unique constraint |
| `workflow_assignments` | Workflow ↔ user_id OR team_id (never permission_group_id) |
| `standards` | Standards documents (head + versions) |
| `devices` | Registered bridge installs. Has `online`, `last_seen`, `wake_endpoint` for the three-state Start button |
| `agent_sessions` | Live + historical agent runs. References `item_id` (which work item this session is on). Reports `git_branch`, `git_commit_sha`, `git_ahead_of_main`, `git_behind_of_main`. |
| `journal_entries` | Append-only event log per session (only what the orchestrator skill / subagents explicitly emit) |
| `decisions` | Open decision requests, routed to user or team (web or mobile) |
| `subscriptions` | Stripe subscription state |
| `audit_log` | Append-only — every org-config mutation and every cloud-issued spawn |

**Removed for v1:** the `primitives` table is no longer in scope (UI primitives deferred). Standards markdown covers the same intent.

---

## Running the bridge on Mac and PC (and Linux)

The bridge daemon is the only piece of Mission Control Pro that runs on the end-user's machine. It needs to feel native on each platform, auto-start at login, and update itself without nagging. Here's how we get there.

### Build & package

| OS | Package format | Built by | Signed/notarized |
|---|---|---|---|
| macOS | `.dmg` containing a `.app` bundle | Tauri + electron-builder-style packaging | Apple Developer ID — required for Gatekeeper, and we notarize each build |
| Windows | `.exe` installer (Inno Setup or MSIX) | Tauri build pipeline | EV code-signing cert — avoids SmartScreen warnings |
| Linux | `.deb` + `.rpm` + `.AppImage` | Tauri build pipeline | GPG-signed apt/yum repo for power users |

We ship a **single repository** that produces all three packages via CI (GitHub Actions matrix). Builds are reproducible by commit.

### Process model per OS

The daemon needs to start at login and run continuously. Each OS has a different convention:

| OS | Auto-start mechanism | Lifecycle |
|---|---|---|
| macOS | **LaunchAgent** plist in `~/Library/LaunchAgents/com.missioncontrol.bridge.plist` | LaunchAgent owns the process, restarts on crash, stops on logout |
| Windows | **Scheduled Task** with "At log on of any user" trigger, or **Windows Service** | Service for v1.1+. v1 uses a per-user Scheduled Task because Service requires admin install and per-machine config — Scheduled Task is friendlier for individual installs |
| Linux | **systemd user unit** (`~/.config/systemd/user/mcp-bridge.service`) | systemd manages restart and resource limits |

The tray icon is a separate process from the daemon on every platform. The daemon survives the tray crashing, and the tray survives the daemon restarting.

### Why Tauri (and not Electron)

- **~10MB installer vs. ~100MB**. The tray UI is tiny — a menu and a small settings popover. Tauri uses the OS's native webview (WebKit on macOS, WebView2 on Windows, WebKitGTK on Linux), so we don't ship Chromium.
- **Lower idle memory**. Tauri tray apps idle around 30–60MB. Electron starts at 150MB+.
- **Faster cold start.** Important for an app that lives in the tray.
- **Rust shim** gives us a clean native layer for things Node can't do (system keychain access, single-instance enforcement, OS-level deep links).

The **daemon** is pure Node — Tauri is only for the tray surface.

### Single-binary daemon

The daemon ships as a compiled Node binary (built with `bun build --compile` or `pkg`) so users don't need a Node runtime installed. The binary embeds the Node runtime + our daemon code. Size ~40MB after compression.

### Self-update

- **macOS:** Sparkle-style update via signed `.zip` deltas. Tauri has built-in updater support that we configure to use our cloud.
- **Windows:** Same updater feed, applies as a replace-and-restart.
- **Linux:** AppImage uses zsync-style diff updates; .deb/.rpm get updated via the package manager (we publish to our own apt/yum repo).

All update artifacts are signed by our release key. Bridges pin the public key at install and verify every update.

### First-run permissions per OS

Each OS has things we need to ask for the first time the bridge runs:

| OS | First-run prompts |
|---|---|
| macOS | "Allow Mission Control to run in the background" (LaunchAgent), keychain access prompt the first time we store the device token |
| Windows | UAC prompt at install time only (we don't need admin at run time). First-run SmartScreen acknowledgment if EV cert isn't fully warmed |
| Linux | None required for user-mode systemd, libsecret prompt the first time we store the device token |

We script these into the first-run experience so the user gets a single clear prompt, not five mystery dialogs.

### Detecting Claude Code

The bridge needs to find the `claude` CLI to spawn it. Discovery order:

1. PATH (`which claude` / `where claude`).
2. Known per-OS install locations (`/usr/local/bin`, `~/.npm-global/bin`, `%APPDATA%/npm`).
3. User-configured override in `~/.mcp-bridge/config.json`.

If we can't find it, the tray shows a clear "Install Claude Code" CTA with a link.

### Test matrix

CI runs the daemon test suite on macOS 14+, Windows 11, and Ubuntu 22.04 + 24.04. Tauri builds get smoke-tested on each as part of the release workflow.

---

## Push notifications on iOS and Android

The push pipeline is the connective tissue between an agent paused on a desktop and the developer who needs to answer from their phone. It has to be reliable, near-instant, and never leak content into the OS notification surface.

### Layers

```
Bridge (desktop) ─► Cloud relay ─► decisions table ─► Push service ─► APNs / FCM ─► Phone
                                                            │
                                                            └─► Realtime ─► Phone (if app is open)
```

### Step by step

1. **Agent emits `decision-required`** — orchestrator skill calls the bridge.
2. **Bridge streams to cloud** over the same WebSocket the bridge uses for everything else.
3. **Cloud writes the `decisions` row** in Postgres. The row creation is a transactional anchor — every other side-effect chains off of it.
4. **Edge Function fires** (Postgres `AFTER INSERT` trigger → Realtime broadcast → Edge Function consumer).
5. **Push service looks up recipient devices** — the `devices` table holds Expo push tokens per (user, install). One user can have multiple phones.
6. **Push request goes to Expo Push** — Expo handles the APNs/FCM split for us, including credential management.
7. **APNs / FCM delivers** to the user's phone.
8. **Phone shows notification.** Payload includes decision ID, feature name, and a short summary line.
9. **Tap opens app** via universal link / app link → app pulls full decision via authenticated API call.

### Why Expo Push (not direct APNs/FCM)

| Concern | Direct APNs/FCM | Expo Push |
|---|---|---|
| Credential management | APNs auth keys, FCM service accounts, certs to rotate | Expo manages |
| Single API surface | Two SDKs, two retry pipelines, two payload formats | One API |
| OS quirks (Android channels, iOS sound categories) | Hand-roll for each | Handled |
| Deliverability monitoring | Roll your own | Built in |
| Cost | Free direct, but engineering time | Free up to scale, paid tier above |
| Lock-in | Low | Medium (could migrate, the model is similar) |

Expo Push pays for itself in engineering time and reduced ops surface. If we hit scale or compliance reasons to leave it, the migration path is mechanical.

### Payload contract

Push payloads contain **wake-up info only** — never the full agent context. Why: the OS may store/log notification content, lock-screens are public, and the decision body can include code snippets.

```json
{
  "to": "ExponentPushToken[...]",
  "title": "Decision needed: checkout-redesign",
  "body": "Pick a layout pattern",
  "data": {
    "type": "decision",
    "decision_id": "dec_...",
    "feature_slug": "checkout-redesign",
    "deep_link": "mcp://decision/dec_..."
  },
  "channelId": "decisions",
  "priority": "high",
  "sound": "default",
  "_displayInForeground": true
}
```

When the user taps, the app uses the deep link to navigate and the decision ID to fetch the full payload via authenticated API — that's where any sensitive content lives.

### Device registration & token lifecycle

- App requests push permission on first launch.
- On grant, Expo issues a token; app POSTs it to cloud with the auth header.
- Cloud upserts a row in `devices` (user_id, platform, expo_token, last_seen).
- Tokens can rotate. Expo signals invalid tokens via push-receipts API; cloud removes stale tokens.
- Signing out from the app explicitly invalidates the device's tokens.

### Multiple devices per user

- One user can have an iPhone, an iPad, and an Android device — all registered.
- Push to all of them in parallel.
- First responder wins (decision is answered once). The push-clear API removes the notification from non-responding devices via silent pushes.

### Silent / data-only pushes

For "decision was already answered by another device, clear the badge," we send a silent push with `content-available: 1` (iOS) / data-only (Android). The app handles it in the background and updates local state.

### Quiet hours / preferences (v1.1)

Out of v1, but worth designing the schema for:

- Per-user quiet hours (no push between 11pm–7am local).
- Per-workflow opt-out ("don't push me about ‹workflow-x›").
- Daily digest mode ("aggregate to one push per day").

The `users.notification_preferences` JSONB column will hold this.

### Reliability targets

| Metric | Target |
|---|---|
| Bridge `decision-required` → push delivered (p95) | < 5 seconds |
| Push delivery success (excluding user-disabled) | > 99% |
| Token rotation handled without user action | > 98% |

### Web push (out of v1)

Browsers support Web Push (VAPID + Service Worker). For v1 we skip it — the web app uses Supabase Realtime when open, and users who want background nudges install the mobile app. If we add web push later, the same `decisions` event fan-out is reused.

---

## Open tech decisions (not yet locked)

These are choices we should make before writing code, but I haven't decided unilaterally:

1. **Single repo (monorepo) vs. multi-repo per surface.** Monorepo simplifies sharing types and refactoring; multi-repo gives each surface a clean deploy/owner story. Lean: monorepo with pnpm workspaces.
2. **Workflow DSL: pure Markdown with YAML frontmatter, or a JSON/AST-backed format with a Markdown view.** Markdown is friendlier to authors and to humans reading diffs; JSON-AST is easier for the bridge to consume. Lean: Markdown source of truth, parsed to AST on save, both stored.
3. **Cursor support in v1.** Adds significant integration surface. Recommendation: ship Claude Code-only, add Cursor in v2.
4. **Self-hosted bridge fleet for Enterprise.** Means the daemon needs to support a tenant-pinned cloud endpoint. Architecturally cheap if we plan for it now.
5. **Audit log destination.** Default: same Postgres. Enterprise: stream to customer S3 or Datadog. Decide before GA.

---

## What we are explicitly *not* using

- **Kubernetes / our own infra.** Supabase + Vercel covers v1 and v2.
- **A custom auth system.** Supabase Auth.
- **A queue (SQS, RabbitMQ, etc.).** Supabase Realtime + Edge Functions cover what we need.
- **GraphQL.** REST + tRPC where convenient. No need for a query language for our shape.
- **Our own AI agent / model.** Position is unambiguous — we route, we don't build.
