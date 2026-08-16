param(
    [string]$DesktopDir = "",
    [string]$AppDir = "",
    [switch]$LaunchSmoke,
    [int]$LaunchSeconds = 8
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

if (-not $DesktopDir) {
    $DesktopDir = Split-Path -Parent $PSScriptRoot
}
$DesktopDir = (Resolve-Path $DesktopDir).Path

if (-not $AppDir) {
    $AppDir = Join-Path $DesktopDir "release\win-unpacked"
}
if (-not (Test-Path $AppDir)) {
    throw "Packaged app directory not found: $AppDir"
}
$AppDir = (Resolve-Path $AppDir).Path

function Assert-File {
    param([string]$Path, [string]$Label)
    if (-not (Test-Path $Path -PathType Leaf)) {
        throw "Missing packaged $Label`: $Path"
    }
}

function Assert-Directory {
    param([string]$Path, [string]$Label)
    if (-not (Test-Path $Path -PathType Container)) {
        throw "Missing packaged $Label`: $Path"
    }
}

$appExe = Join-Path $AppDir "AI Translator.exe"
$resources = Join-Path $AppDir "resources"
$appAsar = Join-Path $resources "app.asar"
$runtime = Join-Path $resources "ocr\runtime"
$manifest = Join-Path $runtime "manifest.json"
$workerExe = Join-Path $runtime "worker\ai-translator-ocr-worker.exe"
$detModel = Join-Path $runtime "models\PP-OCRv6_medium_det"
$recModel = Join-Path $runtime "models\PP-OCRv6_medium_rec"
$tray = Join-Path $resources "assets\tray.png"
# Batch 15.1.4 packaged release-config gate
$releaseConfig = Join-Path $resources "config\release-config.json"

Assert-File $appExe "main executable"
Assert-File $appAsar "app.asar"
Assert-File $manifest "OCR manifest"
Assert-File $workerExe "OCR worker.exe"
Assert-Directory $detModel "OCR detection model"
Assert-Directory $recModel "OCR recognition model"
Assert-File $tray "tray icon"
Assert-File $releaseConfig "production release config"

$VerifyReleaseConfig = Join-Path $PSScriptRoot "verify-release-config.ps1"
& powershell -ExecutionPolicy Bypass -File $VerifyReleaseConfig -DesktopDir $DesktopDir -ConfigPath $releaseConfig
if ($LASTEXITCODE -ne 0) {
    throw "Packaged production release configuration verification failed."
}

# Critical negative checks: development OCR payload must never leak into the app.
$forbidden = @(
    (Join-Path $resources "ocr\.venv"),
    (Join-Path $resources "ocr\worker.py"),
    (Join-Path $resources "ocr\.build")
)
foreach ($path in $forbidden) {
    if (Test-Path $path) {
        throw "Forbidden development OCR artifact was packaged: $path"
    }
}

$manifestJson = Get-Content $manifest -Raw | ConvertFrom-Json
if ([int]$manifestJson.protocol -ne 2) {
    throw "Packaged OCR protocol mismatch: $($manifestJson.protocol)"
}
if ([string]$manifestJson.platform -ne "win32-x64") {
    throw "Packaged OCR platform mismatch: $($manifestJson.platform)"
}

$appBytes = (Get-ChildItem $AppDir -File -Recurse | Measure-Object Length -Sum).Sum
$appMb = [Math]::Round($appBytes / 1MB, 1)

Write-Host "Packaged layout PASS." -ForegroundColor Green
Write-Host "Executable: $appExe"
Write-Host "App directory: $AppDir"
Write-Host "Packaged size: $appMb MB"
Write-Host "OCR protocol: $($manifestJson.protocol)"
Write-Host "OCR models: $($manifestJson.models -join ', ')"

if ($LaunchSmoke) {
    Write-Host "Launching packaged app for $LaunchSeconds seconds..."
    $process = Start-Process -FilePath $appExe -PassThru
    Start-Sleep -Seconds $LaunchSeconds
    $process.Refresh()
    if ($process.HasExited) {
        throw "Packaged app exited during smoke test (exit code $($process.ExitCode))."
    }

    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    Write-Host "Packaged launch smoke PASS." -ForegroundColor Green
}
