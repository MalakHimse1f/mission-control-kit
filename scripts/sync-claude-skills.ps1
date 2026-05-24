# Regenerate claude-skills/ in the unified kit (same folder as commands/ + skills/).
$KitRoot = Split-Path -Parent $PSScriptRoot

Write-Host "Building claude-skills/..."
& (Join-Path $PSScriptRoot 'build-claude-skills.ps1')
Write-Host "Done."
