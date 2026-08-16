param(
    [string]$DesktopDir = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

if (-not $DesktopDir) {
    $DesktopDir = Split-Path -Parent $PSScriptRoot
}
$DesktopDir = (Resolve-Path $DesktopDir).Path
# Batch 15.1.4 release-config gate
$VerifyReleaseConfig = Join-Path $PSScriptRoot "verify-release-config.ps1"
if (-not (Test-Path $VerifyReleaseConfig -PathType Leaf)) {
    throw "verify-release-config.ps1 not found: $VerifyReleaseConfig"
}
& powershell -ExecutionPolicy Bypass -File $VerifyReleaseConfig -DesktopDir $DesktopDir
if ($LASTEXITCODE -ne 0) {
    throw "Production release configuration verification failed."
}

function Assert-PathExists {
    param([string]$Path, [string]$Label)
    if (-not (Test-Path $Path)) {
        throw "Missing $Label`: $Path"
    }
}

$packageJson = Join-Path $DesktopDir "package.json"
$mainFile = Join-Path $DesktopDir "electron\main.cjs"
$preloadFile = Join-Path $DesktopDir "electron\preload.cjs"
$builderConfig = Join-Path $DesktopDir "electron-builder.yml"
$icon = Join-Path $DesktopDir "electron\assets\icon.ico"
$tray = Join-Path $DesktopDir "electron\assets\tray.png"
$runtime = Join-Path $DesktopDir "ocr\runtime"
$manifest = Join-Path $runtime "manifest.json"
$workerExe = Join-Path $runtime "worker\ai-translator-ocr-worker.exe"
$detModel = Join-Path $runtime "models\PP-OCRv6_medium_det"
$recModel = Join-Path $runtime "models\PP-OCRv6_medium_rec"

Assert-PathExists $packageJson "package.json"
Assert-PathExists $mainFile "Electron main process"
Assert-PathExists $preloadFile "Electron preload"
Assert-PathExists $builderConfig "electron-builder config"
Assert-PathExists $icon "Windows icon"
Assert-PathExists $tray "tray icon"
Assert-PathExists $manifest "OCR runtime manifest"
Assert-PathExists $workerExe "packaged OCR worker.exe"
Assert-PathExists $detModel "OCR detection model"
Assert-PathExists $recModel "OCR recognition model"

$pkg = Get-Content $packageJson -Raw | ConvertFrom-Json
if ([string]$pkg.main -ne "electron/main.cjs") {
    throw "package.json main must be electron/main.cjs (current: '$($pkg.main)')."
}

$requiredRuntimeDependencies = @("electron", "sharp", "screenshot-desktop")
foreach ($name in $requiredRuntimeDependencies) {
    if ($name -eq "electron") {
        # Electron itself is normally a devDependency and is packaged by electron-builder.
        $found = $null -ne $pkg.devDependencies -and $null -ne $pkg.devDependencies.PSObject.Properties[$name]
        if (-not $found) {
            throw "Missing devDependency '$name' in package.json."
        }
        continue
    }

    $foundRuntime = $null -ne $pkg.dependencies -and $null -ne $pkg.dependencies.PSObject.Properties[$name]
    if (-not $foundRuntime) {
        throw "'$name' must be under dependencies (not only devDependencies), because packaged Electron uses it at runtime."
    }
}

$manifestJson = Get-Content $manifest -Raw | ConvertFrom-Json
if ([int]$manifestJson.protocol -ne 2) {
    throw "OCR runtime protocol mismatch. Expected 2, got '$($manifestJson.protocol)'."
}

if ([string]$manifestJson.platform -ne "win32-x64") {
    throw "OCR runtime platform must be win32-x64 (got '$($manifestJson.platform)')."
}

$venv = Join-Path $DesktopDir "ocr\.venv"
$venvSizeMb = 0
if (Test-Path $venv) {
    $sum = (Get-ChildItem $venv -File -Recurse -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
    if ($sum) { $venvSizeMb = [Math]::Round($sum / 1MB, 1) }
}

Write-Host "Packaging inputs PASS." -ForegroundColor Green
Write-Host "Desktop: $DesktopDir"
Write-Host "OCR protocol: $($manifestJson.protocol)"
Write-Host "OCR worker layout: $($manifestJson.layout)"
Write-Host "Development .venv present: $([bool](Test-Path $venv)) ($venvSizeMb MB)"
Write-Host "Note: .venv is NOT copied by electron-builder configuration."
