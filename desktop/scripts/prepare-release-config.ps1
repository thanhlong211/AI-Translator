param(
    [string]$DesktopDir = "",
    [string]$BackendUrl = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

if (-not $DesktopDir) {
    $DesktopDir = Split-Path -Parent $PSScriptRoot
}
$DesktopDir = (Resolve-Path $DesktopDir).Path

if ([string]::IsNullOrWhiteSpace($BackendUrl)) {
    $BackendUrl = [string]$env:AI_TRANSLATOR_PRODUCTION_BACKEND_URL
}
$BackendUrl = [string]$BackendUrl
$BackendUrl = $BackendUrl.Trim()

if ([string]::IsNullOrWhiteSpace($BackendUrl)) {
    throw @"
Production backend URL is missing.

Set it before packaging:
  `$env:AI_TRANSLATOR_PRODUCTION_BACKEND_URL = "https://api.example.com"

Then run:
  npm run package:dir
or:
  npm run package:installer
"@
}

$uri = $null
if (-not [System.Uri]::TryCreate($BackendUrl, [System.UriKind]::Absolute, [ref]$uri)) {
    throw "Invalid production backend URL: $BackendUrl"
}

if ($uri.Scheme -ne "https") {
    throw "Production backend must use HTTPS: $BackendUrl"
}

$hostName = ([string]$uri.Host).Trim().ToLowerInvariant()
if (
    $hostName -eq "localhost" -or
    $hostName -eq "127.0.0.1" -or
    $hostName -eq "::1" -or
    $hostName -eq "[::1]" -or
    $hostName.EndsWith(".localhost")
) {
    throw "Production backend must not point to localhost: $BackendUrl"
}

if (-not [string]::IsNullOrWhiteSpace($uri.UserInfo)) {
    throw "Production backend URL must not contain username/password."
}

if (
    $uri.AbsolutePath -ne "/" -or
    -not [string]::IsNullOrWhiteSpace($uri.Query) -or
    -not [string]::IsNullOrWhiteSpace($uri.Fragment)
) {
    throw "Production backend URL must be an origin only, for example https://api.example.com"
}

$PackageJson = Join-Path $DesktopDir "package.json"
if (-not (Test-Path $PackageJson -PathType Leaf)) {
    throw "package.json not found: $PackageJson"
}

$pkg = Get-Content $PackageJson -Raw | ConvertFrom-Json
$version = [string]$pkg.version
if ([string]::IsNullOrWhiteSpace($version)) {
    throw "package.json version is empty."
}

$normalizedBackend = "$($uri.Scheme)://$($uri.Authority)"
$OutputDir = Join-Path $DesktopDir ".release-config"
$OutputFile = Join-Path $OutputDir "release-config.json"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$config = [ordered]@{
    schemaVersion = 1
    environment = "production"
    channel = "stable"
    backendBaseUrl = $normalizedBackend
    appVersion = $version
    generatedAtUtc = [DateTime]::UtcNow.ToString("o")
}

$json = $config | ConvertTo-Json -Depth 10
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText(
    $OutputFile,
    $json + [Environment]::NewLine,
    $utf8NoBom
)

Write-Host "Production release config ready." -ForegroundColor Green
Write-Host "Backend: $normalizedBackend"
Write-Host "Environment: production"
Write-Host "Channel: stable"
Write-Host "App version: $version"
Write-Host "File: $OutputFile"