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

function Publish-UserGuide {
  param([string]$ProjectRootPath, [string]$KitRootPath)
  $src = Join-Path $KitRootPath 'User-Guide.html'
  $dest = Join-Path $ProjectRootPath 'User-Guide.html'
  if (-not (Test-Path $src)) { return }
  $kitName = Split-Path $KitRootPath -Leaf
  $content = Get-Content $src -Raw -Encoding UTF8
  $content = $content -replace 'href="control/', 'href="docs/superpowers/control/'
  $content = $content -replace 'href="Run-Installer\.hta"', "href=`"$kitName/Run-Installer.hta`""
  $content = $content -replace 'href="Run-Installer\.command"', "href=`"$kitName/Run-Installer.command`""
  $content = $content -replace 'href="Run-Updater\.command"', "href=`"$kitName/Run-Updater.command`""
  $content = $content -replace 'href="Run-Updater\.hta"', "href=`"$kitName/Run-Updater.hta`""
  $content = $content -replace 'data-kit-folder="mission-control-kit-v4"', "data-kit-folder=`"$kitName`""
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

Write-Host ''
Write-Host 'Done! Open User-Guide.html or docs/superpowers/control/dashboard.html'
if ($Upgrade) {
  Write-Host 'Specs and features were preserved.'
}
Write-Host ''
