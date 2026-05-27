# v5 Journal Rules

Journals live at `control/v5/features/{slug}/journal/NNN-<step>.md` (zero-padded
sequence). One file per subagent task. Required frontmatter:

```
---
step: <stage or task id>
subagent: <skill name>
status: DONE | BLOCKED
feature: <slug>
completedAt: <ISO-8601>
---
```

Body: what was done, files touched, decisions/commits, and (if BLOCKED) the
blocker. Append only — never rewrite a prior entry.
