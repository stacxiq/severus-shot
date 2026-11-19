# Installs the latest released Severus Shot on Windows.
#   irm https://raw.githubusercontent.com/stacxiq/severus-shot/main/scripts/install.ps1 | iex
param([string]$Repo = $(if ($env:REPO) { $env:REPO } else { 'stacxiq/severus-shot' }))
$ErrorActionPreference = 'Stop'
$release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest"
$asset = $release.assets | Where-Object { $_.name -like '*-setup.exe' } | Select-Object -First 1
if (-not $asset) { throw "No Windows installer in the latest release of $Repo." }
$target = Join-Path $env:TEMP $asset.name
Write-Host "Downloading $($asset.browser_download_url)"
Invoke-WebRequest $asset.browser_download_url -OutFile $target
Start-Process $target -Wait
Write-Host 'Optional: install ffmpeg (winget install ffmpeg) to export motion videos.'
