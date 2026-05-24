# Superpowers plugin — required for Mission Control

Mission Control **orchestrates** the workflow. **Superpowers** provides the skills that do the heavy lifting (refinement questions, phased plans, subagent build loop, verification gates).

You need **both** installed in your project:

| You install | Provides |
|-------------|----------|
| Mission Control kit | `/mc-*` commands, control plane, dashboard, layout library |
| **Superpowers plugin** | `brainstorming`, `writing-plans`, `subagent-driven-development`, `verification-before-completion`, etc. |

---

## When is Superpowers checked?

On **`/mc-braindump`**, the agent runs a **setup check first**. If Superpowers is missing, it stops and shows you these steps — it won't start your feature spec until setup passes.

Optional: run the check yourself anytime:

```bash
node docs/superpowers/control/scripts/check-setup.mjs
```

---

## Install — Cursor

1. Open **Cursor Settings → Plugins** (or the plugin marketplace in Cursor).
2. Search for **Superpowers** (by obra) and install it.
3. **Restart Cursor** or start a **new chat** so skills load.
4. Confirm: type `/skills` in chat — you should see skills like `brainstorming`, `writing-plans`.

If plugins aren't available in your Cursor build, see the [Superpowers Cursor install guide](https://obra-superpowers.mintlify.app/installation/cursor).

---

## Install — Claude Code

In a Claude Code chat session:

```
/plugin install superpowers@claude-plugins-official
```

Or via the Superpowers marketplace:

```
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

Verify:

```
/plugin list
```

Start a **new session** after install.

Docs: [Superpowers — Claude Code install](https://obra-superpowers.mintlify.app/installation/claude-code)

---

## Skills Mission Control uses (by stage)

| Stage | Superpowers skill |
|-------|-------------------|
| Braindump + refine | `brainstorming` |
| Plan | `writing-plans` |
| Build | `subagent-driven-development` |
| Validate | `verification-before-completion` |

Only **`brainstorming`** is required to start `/mc-braindump`. The setup check verifies that one first; the script also warns if others are missing.

---

## After installing

1. Restart your editor / start a new chat session.
2. Run `node docs/superpowers/control/scripts/check-setup.mjs` — all checks should pass.
3. Run `/mc-braindump` + your idea again.
