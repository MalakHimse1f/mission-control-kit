# Orchestrator controls

User toggles saved to **`.mc/orchestrator-controls.json`**. Agents must read this file every `/mc` session alongside `state.json` and `HANDOFF.md`.

The dashboard **control panel** writes this file via the local server:

```bash
node docs/superpowers/control/scripts/dashboard-server.mjs
# Open http://127.0.0.1:9470/
```

Opening `dashboard.html` as `file://` shows controls read-only — use the server to save.

---

## Fields

| Field | Default | Meaning |
|-------|---------|---------|
| `advanceToNextFeature` | `false` | When active feature reaches `pipelineStage: done`, pick next build-queue slug |
| `autoAdvanceScope` | `"build-only"` | Next feature must have plan + tasks; orchestrator runs build → validate only |
| `pauseOnPortfolioDraft` | `true` | Block auto-advance until `portfolioReviewStatus === "approved"` |
| `pauseOnClarify` | `true` | Always stop for AskQuestion — never guess (not disableable) |
| `pauseOnBlocked` | `true` | Stop on BLOCKED subagent or gate failure |
| `ralphLoop.enabled` | `false` | On session end, write `.mc/ralph/resume-prompt.txt` for a fresh orchestrator |
| `ralphLoop.maxSessionsPerDay` | `12` | Rate limit for hook-written prompts |

---

## Auto-advance (build queue)

When `advanceToNextFeature` is **true** and portfolio is **approved**:

1. Feature completes validate → `pipelineStage: done`
2. Orchestrator runs advance logic (`mc-advance-feature.mjs` rules on disk)
3. Sets `state.json` → `activeFeature` to next eligible slug in `buildOrder`
4. Continues build pipeline in same session, **or** stops and writes ralph prompt if `ralphLoop.enabled`

**Eligible next feature:** has `phases/*.md`, `specStatus: approved`, `tasks[]` present, `pipelineStage` is `build` or `validate` (not braindump–plan).

---

## Ralph loop

**Hook (session end):**

```bash
node docs/superpowers/control/scripts/mc-ralph-on-stop.mjs .
```

See `hooks/mc-ralph-on-stop.example.json` for Claude Code wiring.

**Outer loop (optional, manual):**

```bash
export MC_AGENT_CMD='cursor agent -p'   # your launcher
./mission-control-kit/scripts/mc-ralph-loop.sh .
```

The hook writes the prompt; the outer script reads it and spawns the next session.

**Resume prompt builder:**

```bash
node docs/superpowers/control/scripts/mc-write-resume-prompt.mjs . --write
```

---

## Orchestrator rules

On every `/mc` session:

1. Read `.mc/orchestrator-controls.json`
2. Honor `pauseOnClarify` — structured ask tool only
3. On feature done + `advanceToNextFeature` + portfolio approved → advance or ralph
4. Never auto-advance across clarify, portfolio draft, or BLOCKED

---

## Related scripts

| Script | Purpose |
|--------|---------|
| `scripts/dashboard-server.mjs` | Serve dashboard + save controls API |
| `scripts/mc-advance-feature.mjs` | Advance `state.json` to next slug |
| `scripts/mc-write-resume-prompt.mjs` | Build ralph resume text |
| `scripts/mc-ralph-on-stop.mjs` | Session-end hook |
| `../../scripts/mc-ralph-loop.sh` | Outer unattended loop |
