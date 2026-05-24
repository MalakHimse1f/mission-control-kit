# Build claude-skills/ from this kit's commands/ + skills/ (same folder).
$KitRoot = Split-Path -Parent $PSScriptRoot
$out = Join-Path $KitRoot 'claude-skills'

if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out -Force | Out-Null

function Write-ClaudeSkill($name, $frontmatter, $body) {
  $dir = Join-Path $out $name
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
  $content = "---`r`n$frontmatter`r`n---`r`n`r`n$body"
  [System.IO.File]::WriteAllText((Join-Path $dir 'SKILL.md'), $content, [System.Text.UTF8Encoding]::new($false))
}

@('mission-control', 'session-handoff', 'spec-portfolio-review', 'mc-layout') | ForEach-Object {
  $src = [System.IO.File]::ReadAllText((Join-Path $KitRoot "skills\$_\SKILL.md"))
  if ($src -match '(?s)^---\r?\n(.*?)\r?\n---\r?\n(.*)$') {
    $fm = $Matches[1].TrimEnd()
    $body = $Matches[2].TrimStart()
    if ($fm -notmatch 'user-invocable') { $fm += "`r`nuser-invocable: false" }
    Write-ClaudeSkill $_ $fm $body
  }
}

$hints = @{
  'mc' = '[stage]'
  'mc-init' = ''
  'mc-braindump' = '[describe your idea]'
  'mc-refine' = '[feature-slug]'
  'mc-plan' = '[feature-slug]'
  'mc-validate' = '[feature-slug] [phase-N]'
}

Get-ChildItem (Join-Path $KitRoot 'commands\mc*.md') | ForEach-Object {
  $name = $_.BaseName
  $raw = [System.IO.File]::ReadAllText($_.FullName)
  if ($raw -match '(?s)^---\r?\n(.*?)\r?\n---\r?\n(.*)$') {
    $fm = $Matches[1].TrimEnd()
    $body = $Matches[2].TrimStart()
    $body = $body -replace '\*\*MUST invoke:\*\* `mission-control` skill, then \*\*`superpowers:([^`]+)`\*\* skill\.', '**First:** Load the `mission-control` skill, then load the Superpowers `$1` skill (Skill tool).'
    $body = $body -replace '\*\*MUST invoke:\*\* `mission-control` skill, then \*\*`([^`]+)`\*\* skill\.', '**First:** Load the `mission-control` skill, then load the `$1` skill (Skill tool).'
    $body = $body -replace '\*\*MUST invoke:\*\* `mission-control` skill \(read it now\)\.', '**First:** Load the `mission-control` skill (Skill tool).'
    $body = $body -replace 'Start a NEW chat', 'Start a NEW session'
    $body = $body -replace '(?<![A-Za-z])new chat(?![A-Za-z])', 'new session'
    $body = $body -replace 'Cursor browser', 'browser'
    $body = $body -replace '`AskQuestion`', '`AskUserQuestion`'
    if ($fm -notmatch 'disable-model-invocation') { $fm += "`r`ndisable-model-invocation: true" }
    if ($hints.ContainsKey($name) -and $hints[$name] -and $fm -notmatch 'argument-hint') {
      $fm += "`r`nargument-hint: $($hints[$name])"
    }
    Write-ClaudeSkill $name $fm $body
  }
}

Write-Host "Built $(@(Get-ChildItem $out -Directory).Count) skills in claude-skills/"
