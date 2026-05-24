# Superpowers — bundled with Mission Control

Mission Control **orchestrates** the workflow. **[Superpowers](https://github.com/obra/superpowers)** (by Jesse Vincent / obra, MIT) provides brainstorming, planning, build-loop, and verification patterns.

## Bundled on install

`install.sh` / `mc-upgrade` runs `bundle-vendor-skills.sh`, which clones Superpowers into:

- `.claude/skills/vendor/superpowers/{skill}/SKILL.md`
- `.cursor/skills/vendor/superpowers/{skill}/SKILL.md` (mirrored for Cursor)

Required skills for Mission Control:

| Skill | Stage |
|-------|--------|
| `brainstorming` | Braindump / clarify |
| `writing-plans` | Plan |
| `subagent-driven-development` | Build |
| `verification-before-completion` | Validate (Add Feature) |

Verify:

```bash
node mission-control-kit/scripts/check-vendor-skills.mjs . all
node docs/superpowers/control/scripts/check-setup.mjs
```

If bundles are missing, dispatch **`mc-setup-skills`** or re-run install.

---

## Optional: Superpowers plugin

You can still install the official plugin for marketplace updates. Bundled copy takes precedence in `check-setup.mjs` when present.

### Cursor

1. **Cursor Settings → Plugins** → install **Superpowers** (obra)
2. Restart Cursor / new chat

[Cursor install guide](https://obra-superpowers.mintlify.app/installation/cursor)

### Claude Code

```
/plugin install superpowers@claude-plugins-official
```

Or:

```
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

[Claude Code install guide](https://obra-superpowers.mintlify.app/installation/claude-code)

---

## Additional Superpowers skills (in bundle, optional)

The full repo includes 14 skills — Mission Control requires the four above. Others (e.g. `systematic-debugging`, `test-driven-development`, `using-git-worktrees`) are available under `.claude/skills/vendor/superpowers/` for ad-hoc use.
