param(
    [string]$DesktopDir = "",
    [string]$InstallerPath = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

if (-not $DesktopDir) {
    $DesktopDir = Split-Path -Parent $PSScriptRoot
}
$DesktopDir = (Resolve-Path $DesktopDir).Path
$PackageJson = Join-Path $DesktopDir "package.json"
$ReleaseDir = Join-Path $DesktopDir "release"

if (-not (Test-Path $PackageJson -PathType Leaf)) {
    throw "package.json not found: $PackageJson"
}
if (-not (Test-Path $ReleaseDir -PathType Container)) {
    throw "release directory not found: $ReleaseDir"
}

$pkg = Get-Content $PackageJson -Raw | ConvertFrom-Json
$version = [string]$pkg.version
if ([string]::IsNullOrWhiteSpace($version)) {
    throw "package.json version is empty."
}

if (-not $InstallerPath) {
    $expectedName = "AitraNova-Setup-$version-x64.exe"
    $expectedPath = Join-Path $ReleaseDir $expectedName
    if (Test-Path $expectedPath -PathType Leaf) {
        $InstallerPath = $expectedPath
    } else {
        $matches = @(Get-ChildItem $ReleaseDir -File -Filter "AitraNova-Setup-*.exe" | Sort-Object LastWriteTime -Descending)
        if ($matches.Count -eq 0) {
            throw "NSIS installer not found in $ReleaseDir. Expected: $expectedName"
        }
        if ($matches.Count -gt 1) {
            Write-Host "Multiple installer artifacts found; verifying newest: $($matches[0].Name)" -ForegroundColor Yellow
        }
        $InstallerPath = $matches[0].FullName
    }
}

$InstallerPath = (Resolve-Path $InstallerPath).Path
$item = Get-Item $InstallerPath
if ($item.Length -le 0) {
    throw "Installer is empty: $InstallerPath"
}

# Basic PE signature check: Windows executables begin with MZ.
$stream = [System.IO.File]::OpenRead($InstallerPath)
try {
    $b0 = $stream.ReadByte()
    $b1 = $stream.ReadByte()
} finally {
    $stream.Dispose()
}
if ($b0 -ne 0x4D -or $b1 -ne 0x5A) {
    throw "Installer does not have a valid Windows PE MZ header: $InstallerPath"
}

$hash = Get-FileHash -Algorithm SHA256 -Path $InstallerPath
$sizeMb = [Math]::Round($item.Length / 1MB, 1)
$signature = Get-AuthenticodeSignature -FilePath $InstallerPath

Write-Host "Installer artifact PASS." -ForegroundColor Green
Write-Host "Installer: $InstallerPath"
Write-Host "Version: $version"
Write-Host "Size: $sizeMb MB"
Write-Host "SHA256: $($hash.Hash)"
Write-Host "Authenticode: $($signature.Status)"

if ($signature.Status -ne "Valid") {
    Write-Host "Code signing is not required for Batch 15.1.3; it is scheduled for Batch 15.1.5." -ForegroundColor Yellow
}
