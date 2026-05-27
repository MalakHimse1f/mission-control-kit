# Build claude-skills/ from this kit's skills/ (the canonical source of every skill).
#
# Every shipped skill exists as skills/<id>/SKILL.md and is already in its final,
# ready-to-ship shape (frontmatter + body). The commands/ directory now holds only
# thin redirect/alias command files (no full skill content), so it is NOT a faithful
# source for the generated skills -- skills/ is. This script therefore emits one
# claude-skill per skills/<id>/SKILL.md, copying the source verbatim and adding only
# the few presentation-frontmatter fields that the shipped claude-skills carry on top
# of the source (e.g. user-invocable / disable-model-invocation), which are listed in
# $FrontmatterExtras below.
#
# Frontmatter parsing strips a leading UTF-8 BOM so a BOM-prefixed source file is never
# silently skipped by the ^--- frontmatter regex.

$KitRoot = Split-Path -Parent $PSScriptRoot
$out = Join-Path $KitRoot 'claude-skills'
$skillsDir = Join-Path $KitRoot 'skills'

if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out -Force | Out-Null

function Write-ClaudeSkill($name, $frontmatter, $body) {
  $dir = Join-Path $out $name
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
  $content = "---`r`n$frontmatter`r`n---`r`n`r`n$body"
  [System.IO.File]::WriteAllText((Join-Path $dir 'SKILL.md'), $content, [System.Text.UTF8Encoding]::new($false))
}

# Presentation-frontmatter fields that the shipped claude-skills add on top of the
# source frontmatter. The source already carries these for most skills; only the few
# below need them appended. Each value is added only if not already present.
$FrontmatterExtras = @{
  'mc'              = @('disable-model-invocation: true')
  'mc-explore'      = @('user-invocable: false')
  'mission-control' = @('user-invocable: false')
}

$built = 0
Get-ChildItem $skillsDir -Directory | Sort-Object Name | ForEach-Object {
  $name = $_.Name
  $skillFile = Join-Path $_.FullName 'SKILL.md'
  if (-not (Test-Path $skillFile)) { return }

  $raw = [System.IO.File]::ReadAllText($skillFile)
  # Strip a leading UTF-8 BOM (U+FEFF) so the ^--- frontmatter match never silently fails.
  $bom = [char]0xFEFF
  if ($raw.Length -gt 0 -and $raw[0] -eq $bom) { $raw = $raw.Substring(1) }

  if ($raw -match '(?s)^---\r?\n(.*?)\r?\n---\r?\n(.*)$') {
    $fm = $Matches[1].TrimEnd()
    $body = $Matches[2].TrimStart()

    if ($FrontmatterExtras.ContainsKey($name)) {
      foreach ($field in $FrontmatterExtras[$name]) {
        $key = ($field -split ':', 2)[0].Trim()
        if ($fm -notmatch "(?m)^\s*$([regex]::Escape($key))\s*:") {
          $fm += "`r`n$field"
        }
      }
    }

    Write-ClaudeSkill $name $fm $body
    $built++

    # Copy any companion .md files (e.g. skills/mc/mc.md) verbatim alongside SKILL.md.
    Get-ChildItem $_.FullName -Filter '*.md' -File |
      Where-Object { $_.Name -ne 'SKILL.md' } |
      ForEach-Object {
        $dest = Join-Path (Join-Path $out $name) $_.Name
        $companion = [System.IO.File]::ReadAllText($_.FullName)
        if ($companion.Length -gt 0 -and $companion[0] -eq $bom) { $companion = $companion.Substring(1) }
        [System.IO.File]::WriteAllText($dest, $companion, [System.Text.UTF8Encoding]::new($false))
      }
  } else {
    Write-Warning "Skipping $name - no frontmatter block found in SKILL.md"
  }
}

Write-Host "Built $built skills in claude-skills/"
