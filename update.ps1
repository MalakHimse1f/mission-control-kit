param(
  [Parameter(Mandatory = $false)]
  [string]$ProjectRoot,
  [Parameter(Mandatory = $false)]
  [ValidateSet('cursor', 'claude', 'both')]
  [string]$Target = 'both'
)

& (Join-Path $PSScriptRoot 'install.ps1') -ProjectRoot $ProjectRoot -Target $Target -PreserveProjectState
