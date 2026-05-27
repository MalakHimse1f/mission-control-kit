# Build claude-skills/ from skills/ via the cross-platform Node builder.
# claude-skills/ is a straight copy of skills/ (every SKILL.md already has
# valid frontmatter after the v5 rewrite — no transform needed).
$KitRoot = Split-Path -Parent $PSScriptRoot
& node (Join-Path $KitRoot 'scripts/build-claude-skills.mjs')
