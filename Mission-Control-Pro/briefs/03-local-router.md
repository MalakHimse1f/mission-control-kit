# Brief 03 — Local Router (Bridge Daemon)

**Surface:** `mcp-bridge` — installed per developer machine
**Owner:** TBD
**Status:** Draft v0
**Last updated:** 2026-05-26

---

## Purpose

The bridge is the **only** thing that connects the cloud to a developer's actual Claude Code session. It's a small, always-on local process that:

1. **Authenticates the machine** with the org's cloud workspace.
2. **Syncs org config** (workflows and standards) into a local cache.
3. **Receives signed spawn events** from the cloud and launches Claude Code (or Cursor in v2).
4. **Pipes structured events back to the cloud** — journal entries, stage changes, decision requests.
5. **Stays out of the way** when not in use — tray icon, low resource use, no UI of its own beyond settings.

The bridge is also the product's **security boundary**. Getting it right is the difference between a useful product and a remote-code-execution vector.

---

## Target user

The developer running an AI coding agent on their own machine. They didn't ask for another background process — they tolerate it because it gives them visibility into their org and lets their PM see what they're working on.

The bridge should feel like 1Password's desktop app: installed once, almost invisible, instantly trusted because it does one thing well.

---

## Scope

### In scope (v1)

- Auth pairing flow: web app generates a pairing code, user types it into the bridge tray UI.
- Cloud sync: pull workflows, standards, and assignments for the current user.
- Local cache (SQLite) with signed manifest of org config.
- WebSocket connection to cloud relay with reconnect/backoff.
- **Online-required:** bridge refuses to spawn or attach if the cloud is unreachable. Cloud visibility is a hard product requirement; "agents working invisibly" is not a state we tolerate. Tray shows a clear "offline — agent disabled" indicator with a Pause Bridge action so retries don't churn.
- Spawn Claude Code with the correct command in the right working directory.
- **Git detection on session start:** read `.git/config` for `remote.origin.url`, current branch (`HEAD`), last commit SHA, and ahead/behind counts vs. `main`. Reports these on the `session-started` event and on every branch change.
- **Project auto-link suggestion:** if the detected repo URL matches a Project's `project_repos` row, attach the session to that Project automatically. If no match, the bridge surfaces an "Attach to Project?" prompt the next time the user opens the web app.
- Capture structured events from the orchestrator skill via Claude Code hooks (hooks are unbypassable — every important event must journal).
- Stream events to cloud.
- File-system watcher on `.mc/` directories for state file changes.
- Tray UI: status, recent sessions, settings, pause/resume, logs.
- **`mcp lint` CLI** for workflow authors — validates workflow files against the schema. Ships in the bridge installer.
- **Tray "preview dispatch"** panel — author selects a workflow + repo; bridge builds and prints the context packet without invoking Claude.
- Self-update via signed release artifacts.
- Logs (local-only, rotated) for troubleshooting.

### Out of scope (v1)

- Cursor integration (v2).
- Multi-org device (one bridge install belongs to one user + one org). v2 if needed.
- Running on headless servers (CI/CD). v2.
- Editing workflows offline in the bridge UI.
- Mobile-style decision UI in the bridge tray. Web app + mobile cover that.
- Native installer signing for OS app stores (we're not in stores in v1).

---

## Architecture

### Processes

1. **Daemon (Node.js)** — long-running, the actual work happens here.
   - WebSocket client, event dispatcher, sync engine, sqlite cache, file watcher, child process supervisor.
2. **Tray UI (Tauri shell)** — minimal native menu + settings popover.
   - Talks to daemon over a local Unix socket / named pipe.

### Folder layout (per OS)

```
~/.mcp-bridge/
├── config.json           # device ID, server endpoint, user info
├── cache.db              # SQLite — workflows and standards (last known)
├── logs/                 # rotated log files
├── manifests/            # signed config manifests by version
└── bin/                  # bridge binary + self-update staging
```

There is no offline event queue. If the cloud is unreachable, the bridge will not spawn or attach an agent (see online-required note above).

### Repo-side state

In the user's repo (or the repo the bridge is operating on):

```
<repo-root>/
└── .mcp/
    ├── link.json         # binds repo to an org workspace + workflow
    ├── state.json        # latest known stage / feature
    └── journal/          # event log files (also synced to cloud)
```

The `.mcp/link.json` file is what tells the bridge "this repo belongs to org X, workflow Y." Without it, the bridge won't operate on the repo.

---

## Key flows

### 1. First install + pairing

1. User downloads installer from marketing site, runs it.
2. Daemon starts, tray icon appears with "Not paired" state.
3. User clicks tray → "Pair with org."
4. Tray opens browser to `app.missioncontrol.pro/pair?code=ABCD-1234`.
5. User confirms in web app (must already be logged in).
6. Web app POSTs the pairing code → cloud → relay → bridge daemon.
7. Daemon receives device-bound token, persists, marks itself "Online."
8. Initial sync pulls all org config the user has access to.

### 2. Sync on change

1. Org admin edits a workflow in the web app.
2. New version is committed to `workflow_versions`.
3. Cloud broadcasts a `config-changed` event to all online bridges in the org.
4. Bridge daemon fetches the new version + verifies signature.
5. Cache updated. Tray shows a brief "synced" indicator.
6. In-flight sessions continue on their pinned version — only new sessions use the latest.

### 3. Cloud-initiated spawn

1. User clicks "Start" on a feature in the web dashboard.
2. Cloud emits a signed `spawn-session` event over the relay's WebSocket.
3. Bridge daemon verifies signature against pinned cloud public key.
4. Daemon resolves: which workspace? which command? which working directory?
5. **First-run prompt:** if this is the first spawn against this working directory, tray pops up a confirmation. User clicks Approve. Trust persists.
6. Daemon spawns `claude` CLI with the resolved command.
7. Daemon attaches via Claude Code hooks (configured by our orchestrator skill).
8. Events flow back.

### 4. Event capture & streaming

Sources of structured events on the bridge side:

- **Claude Code hooks** (via the orchestrator skill we ship):
  - `SessionStart` — marks a session "started"
  - `PostToolUse` for writes to `.mcp/state.json` or `.mcp/journal/` — relayed as state diffs
  - `Stop` — marks a session "completed" or "paused"
- **File watcher on `.mcp/` directories** — backup for hooks; we should never depend on a single signal.
- **Orchestrator skill explicit calls** — when the skill calls our `mcp-emit` helper, we get a clean structured event.

Each event is normalized into the protocol envelope, queued, sent. Offline queue persists on disk.

### 5. Decision flow (cloud → user)

1. Workflow reaches a `decide` step in the agent session.
2. Orchestrator skill emits a `decision-required` event via the bridge.
3. Bridge streams it to cloud.
4. Cloud writes to `decisions` table, fires push notification + Realtime event.
5. User answers in web or mobile.
6. Cloud writes the answer back into `decisions`.
7. Cloud emits `decision-answered` event to the originating bridge.
8. Bridge writes the answer into `.mcp/decisions.json` or signals the orchestrator skill directly.
9. Agent reads the decision and continues.

---

## Tech stack

See `tech-stack.md`. Short:

- **Daemon:** Node.js LTS, single-binary build (bun build --compile or pkg).
- **Tray UI:** Tauri (macOS, Windows, Linux).
- **IPC tray ↔ daemon:** Unix socket / named pipe with JSON messages.
- **Transport:** WebSocket via `ws` library over TLS, signed envelopes.
- **Cache:** SQLite via better-sqlite3.
- **File watching:** Chokidar.
- **Logs:** Pino with rotation.

---

## Security model

The bridge can launch processes on the user's machine. This is the highest-risk component in the product. Everything below is required, not optional.

### Identity & auth

- Device gets a **device-bound key pair** at pair time. Private key stored in OS keychain (macOS Keychain, Windows Credential Manager, libsecret on Linux).
- Cloud has a known public key; bridge pins it at install.
- Every WebSocket session authenticates with a short-lived JWT signed by the device key, refreshed every N minutes.

### Event signing

- Every command from cloud to bridge (`spawn-session`, `revoke`, `sync-now`, `kill`) is a signed envelope:
  ```json
  {
    "v": 1,
    "id": "evt_...",
    "nonce": "...",
    "issued_at": "...",
    "expires_at": "...",
    "payload": { "type": "spawn-session", ... },
    "signature": "..."   // signed by cloud's signing key
  }
  ```
- Bridge verifies signature, checks nonce against replay cache, drops if expired.

### Command allowlist

The bridge has a hard-coded list of programs it will spawn. v1: `claude` only. The cloud cannot tell the bridge to run `rm -rf` or anything else — those payloads are rejected by the daemon before reaching the spawn layer.

### First-run consent

The first time any workspace path appears in a `spawn-session` payload, the tray prompts the user: "Allow agent sessions in `~/code/your-project`?" Trust persists until revoked by the user (via tray) or org admin (via web app).

### Kill switch

- User can pause the bridge from the tray (no events accepted, no spawns).
- Org admin can revoke a device from the web app — invalidates its tokens, severs the WebSocket.
- Org admin can kill-switch the entire org — revokes all devices.

### What the bridge does *not* send

- Source code from the user's repo.
- Free-form chat transcripts.
- Anything not explicitly emitted by the orchestrator skill or written into `.mcp/`.

This boundary is the privacy contract. It needs to be enforceable in code, not by convention.

---

## Local UX (tray)

The tray icon has three states:

| State | Icon | Meaning |
|---|---|---|
| Connected | Solid | Authenticated, online, idle |
| Working | Pulsing | A session is running |
| Offline / Paused | Outline | Disconnected or paused by user |

Tray menu:

- Current status
- Recent sessions (last 5, click to open in web)
- Pause / Resume
- Open settings
- Quit

Settings popover (Tauri webview):

- Account: who I am, what org, sign out
- Workspaces: paths the bridge is trusted to operate on
- Sync status: last sync, next sync, version
- Logs: open log directory
- Update: check for updates, current version

---

## Failure modes & observability

| Failure | Behavior |
|---|---|
| Cloud unreachable | Bridge refuses to spawn or attach. In-flight sessions are signaled to pause at the next `decide` step. Tray shows "Offline — agent disabled" with Pause Bridge action. Retry with exponential backoff. |
| Claude Code not installed | Tray shows "Claude Code not found" with install link. Spawn requests get a `prereq-missing` error reply. |
| Invalid signature on event | Drop, log, alert cloud (so we can detect attacks). |
| Hook fails / orchestrator skill misbehaves | Bridge degrades gracefully — file watcher still picks up state changes. |
| Daemon crashes | OS-level supervision restarts it (LaunchAgent, Windows Service, systemd user unit). |
| Disk full | Pause queue, alert via tray. |
| Token expired | Auto-refresh; if refresh fails, prompt for re-pair. |

Telemetry (local-only by default, opt-in to cloud):

- Daemon uptime, event throughput, queue depth.
- Sync latency.
- Spawn success/failure counts.
- No content, ever.

---

## Open questions

1. **One bridge per machine or one per user-in-org?** If a person belongs to two orgs, do they install two bridges? Lean: one bridge process, multiple paired workspaces — but v1 ships single-org and we revisit.
2. **Working-directory resolution.** The web app needs to know where to send the spawn. Options: (a) bridge advertises a list of "linked repos" from its `.mcp/link.json` files; (b) cloud stores a canonical mapping. Lean: bridge advertises, cloud caches.
3. **Spawn UI.** When the agent opens, what does the user see? Their existing terminal? A new terminal window? An in-IDE invocation? Claude Code is a CLI — we likely spawn in a new terminal window with a recognizable title. Confirm.
4. **Update channels.** Auto-update by default for stability releases; opt into a beta channel. Confirm.
5. **MDM / corporate install.** Enterprises want MSI / pkg installers with config baked in. v1 ships individual installers; enterprise gets a v2 deployment kit.
