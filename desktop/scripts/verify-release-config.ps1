param(
    [string]$DesktopDir = "",
    [string]$ConfigPath = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

if (-not $DesktopDir) {
    $DesktopDir = Split-Path -Parent $PSScriptRoot
}
$DesktopDir = (Resolve-Path $DesktopDir).Path

if (-not $ConfigPath) {
    $ConfigPath = Join-Path $DesktopDir ".release-config\release-config.json"
}

if (-not (Test-Path $ConfigPath -PathType Leaf)) {
    throw "Production release config not found: $ConfigPath"
}

$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json

if ([int]$config.schemaVersion -ne 1) {
    throw "Release config schemaVersion must be 1."
}

if ([string]$config.environment -ne "production") {
    throw "Release config environment must be production."
}

if ([string]$config.channel -ne "stable") {
    throw "Release config channel must be stable."
}

$backend = ([string]$config.backendBaseUrl).Trim()
$uri = $null
if (-not [System.Uri]::TryCreate($backend, [System.UriKind]::Absolute, [ref]$uri)) {
    throw "Release config backendBaseUrl is invalid: $backend"
}

if ($uri.Scheme -ne "https") {
    throw "Packaged backend must use HTTPS: $backend"
}

$hostName = ([string]$uri.Host).Trim().ToLowerInvariant()
if (
    $hostName -eq "localhost" -or
    $hostName -eq "127.0.0.1" -or
    $hostName -eq "::1" -or
    $hostName -eq "[::1]" -or
    $hostName.EndsWith(".localhost")
) {
    throw "Packaged backend must not point to localhost: $backend"
}

if (-not [string]::IsNullOrWhiteSpace($uri.UserInfo)) {
    throw "Packaged backend URL must not contain username/password."
}

if (
    $uri.AbsolutePath -ne "/" -or
    -not [string]::IsNullOrWhiteSpace($uri.Query) -or
    -not [string]::IsNullOrWhiteSpace($uri.Fragment)
) {
    throw "Packaged backend URL must be an origin only."
}

$PackageJson = Join-Path $DesktopDir "package.json"
if (Test-Path $PackageJson -PathType Leaf) {
    $pkg = Get-Content $PackageJson -Raw | ConvertFrom-Json
    $version = [string]$pkg.version
    if (
        -not [string]::IsNullOrWhiteSpace([string]$config.appVersion) -and
        [string]$config.appVersion -ne $version
    ) {
        throw "Release config appVersion '$($config.appVersion)' does not match package.json '$version'. Regenerate release config."
    }
}

Write-Host "Production release config PASS." -ForegroundColor Green
Write-Host "Config: $ConfigPath"
Write-Host "Backend: $backend"
Write-Host "Environment: $($config.environment)"
Write-Host "Channel: $($config.channel)"