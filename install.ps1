param(
  [Parameter(Mandatory = $false)]
  [string]$ProjectRoot,
  [Parameter(Mandatory = $false)]
  [ValidateSet('cursor', 'claude', 'both')]
  [string]$Target = 'both',
  [switch]$Upgrade
)

$ErrorActionPreference = 'Stop'
$KitRoot = $PSScriptRoot

function Select-ProjectFolder {
  Add-Type -AssemblyName System.Windows.Forms
  $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
  $dialog.Description = 'Select your project folder'
  $dialog.ShowNewFolderButton = $true
  if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
    Write-Host 'Cancelled.'
    exit 1
  }
  return $dialog.SelectedPath
}

function Get-DefaultProjectRoot {
  param([string]$KitRootPath)
  $kitName = Split-Path $KitRootPath -Leaf
  if ($kitName -notmatch '^mission-control-kit') { return $null }
  return (Resolve-Path (Join-Path $KitRootPath '..')).Path
}

function Get-InstallLayoutKind {
  param([string]$ProjectRootPath, [string]$KitName)
  # Mirror lib/layout.mjs resolveLayout priority: stamp at kit-nested first,
  # then root, then v4. Falls back to the new kit-nested default for fresh
  # installs so User-Guide.html lands inside the kit folder.
  if (Test-Path (Join-Path $ProjectRootPath "$KitName\.mc\install.json")) { return 'kit-nested' }
  if (Test-Path (Join-Path $ProjectRootPath '.mc\install.json'))         { return 'root' }
  if (Test-Path (Join-Path $ProjectRootPath 'docs\superpowers\control\.mc\install.json')) { return 'legacy-v4' }
  if (Test-Path (Join-Path $ProjectRootPath "$KitName\control"))         { return 'kit-nested' }
  if (Test-Path (Join-Path $ProjectRootPath 'control'))                  { return 'root' }
  return 'kit-nested'
}

function Publish-UserGuide {
  param([string]$ProjectRootPath, [string]$KitRootPath)
  $src = Join-Path $KitRootPath 'User-Guide.html'
  if (-not (Test-Path $src)) { return }
  $kitName = Split-Path $KitRootPath -Leaf
  $layout = Get-InstallLayoutKind -ProjectRootPath $ProjectRootPath -KitName $kitName

  # v5.3+ kit-nested: User-Guide.html lives INSIDE the kit folder, so the
  # `href="control/..."` links resolve relative to the kit root. The Run-*
  # entry-point launchers are siblings of the guide inside the kit folder,
  # so the kit-name prefix isn't needed either.
  if ($layout -eq 'kit-nested') {
    $dest = Join-Path $ProjectRootPath "$kitName\User-Guide.html"
    $destDir = Split-Path $dest -Parent
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    $content = Get-Content $src -Raw -Encoding UTF8
    $content = $content -replace 'data-kit-folder="mission-control-kit"', "data-kit-folder=`"$kitName`""
    [System.IO.File]::WriteAllText($dest, $content)
    Write-Host "Created User-Guide.html inside $kitName/"
    return
  }

  # Legacy v5.2 root layout: User-Guide.html lives at the project root.
  # The guide references paths as mission-control-kit/control/..., so no
  # path-prefix rewrite is needed regardless of layout variant.
  $dest = Join-Path $ProjectRootPath 'User-Guide.html'
  $content = Get-Content $src -Raw -Encoding UTF8
  $content = $content -replace 'href="Run-Installer\.hta"', "href=`"$kitName/Run-Installer.hta`""
  $content = $content -replace 'href="Run-Installer\.command"', "href=`"$kitName/Run-Installer.command`""
  $content = $content -replace 'href="Run-Updater\.command"', "href=`"$kitName/Run-Updater.command`""
  $content = $content -replace 'href="Run-Updater\.hta"', "href=`"$kitName/Run-Updater.hta`""
  $content = $content -replace 'data-kit-folder="mission-control-kit"', "data-kit-folder=`"$kitName`""
  [System.IO.File]::WriteAllText($dest, $content)
  Write-Host 'Created User-Guide.html at project root'
}

if (-not $ProjectRoot) {
  $defaultRoot = Get-DefaultProjectRoot -KitRootPath $KitRoot
  if ($defaultRoot) { $ProjectRoot = $defaultRoot }
  else { $ProjectRoot = Select-ProjectFolder }
}

$ProjectRoot = (Resolve-Path $ProjectRoot).Path
$modeLabel = if ($Upgrade) { 'Updating' } else { 'Installing' }
Write-Host ''
Write-Host "$modeLabel Mission Control ($Target) into:"
Write-Host "  $ProjectRoot"
Write-Host ''

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error 'Node.js is required.'
}

$upgradeScript = Join-Path $KitRoot 'scripts\mc-upgrade.mjs'
$args = @($upgradeScript, $ProjectRoot, "--target=$Target")
if (-not $Upgrade) { $args += '--install' }

& node @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Publish-UserGuide -ProjectRootPath $ProjectRoot -KitRootPath $KitRoot

Push-Location $ProjectRoot
try {
  if (Test-Path 'docs\superpowers\control\scripts\check-setup.mjs') {
    & node docs/superpowers/control/scripts/check-setup.mjs
  }
} finally {
  Pop-Location
}

$kitFolder = Split-Path $KitRoot -Leaf
$installedLayout = Get-InstallLayoutKind -ProjectRootPath $ProjectRoot -KitName $kitFolder
Write-Host ''
if ($installedLayout -eq 'kit-nested') {
  Write-Host "Done! Open $kitFolder/User-Guide.html, or launch the v5 dashboard:"
  Write-Host "  node $kitFolder/control/scripts/v5/dashboard-server.mjs ."
} else {
  Write-Host 'Done! Open User-Guide.html, or launch the v5 dashboard:'
  Write-Host "  node $kitFolder/control/scripts/v5/dashboard-server.mjs ."
}
if ($Upgrade) {
  Write-Host 'Specs and features were preserved.'
}
Write-Host ''
