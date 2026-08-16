param(
    [switch]$SkipUnpackedBuild,
    [switch]$SkipInputCheck,
    [switch]$KeepPreviousInstaller
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$DesktopDir = Split-Path -Parent $PSScriptRoot
$DesktopDir = (Resolve-Path $DesktopDir).Path
$Builder = Join-Path $DesktopDir "node_modules\.bin\electron-builder.cmd"
$BuilderConfig = Join-Path $DesktopDir "electron-builder.yml"
$PackageJson = Join-Path $DesktopDir "package.json"
$ReleaseDir = Join-Path $DesktopDir "release"
$AppDir = Join-Path $ReleaseDir "win-unpacked"
$VerifyInputs = Join-Path $PSScriptRoot "verify-packaging-inputs.ps1"
$VerifyPackaged = Join-Path $PSScriptRoot "verify-packaged-app.ps1"
$VerifyInstaller = Join-Path $PSScriptRoot "verify-installer.ps1"

if ($env:OS -ne "Windows_NT") {
    throw "Batch 15.1.3 NSIS installer must be built on Windows."
}

function Invoke-ExplicitNsisBuild {
    # Batch 15.1.2 found that legacy package.json#build can be merged with an
    # external electron-builder config. For release packaging, electron-builder.yml
    # is the single source of truth. Temporarily remove package.json#build and
    # restore package.json byte-for-byte after the NSIS command finishes.
    $originalBytes = [System.IO.File]::ReadAllBytes($PackageJson)
    $sanitized = $false

    try {
        $pkg = Get-Content $PackageJson -Raw | ConvertFrom-Json
        if ($pkg.PSObject.Properties["build"]) {
            $pkg.PSObject.Properties.Remove("build")
            $json = $pkg | ConvertTo-Json -Depth 100
            $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
            [System.IO.File]::WriteAllText(
                $PackageJson,
                $json + [Environment]::NewLine,
                $utf8NoBom
            )
            $sanitized = $true
            Write-Host "Temporarily isolated legacy package.json#build configuration." -ForegroundColor Yellow
        }

        Write-Host "Building NSIS x64 installer from verified win-unpacked payload..."
        & $Builder --config $BuilderConfig --win nsis --x64 --prepackaged $AppDir --publish never
        if ($LASTEXITCODE -ne 0) {
            throw "electron-builder NSIS build failed (exit code $LASTEXITCODE)."
        }
    }
    finally {
        if ($sanitized) {
            [System.IO.File]::WriteAllBytes($PackageJson, $originalBytes)
            Write-Host "Restored original package.json." -ForegroundColor DarkGray
        }
    }
}

Push-Location $DesktopDir
try {
    Write-Host "[AI Translator] Batch 15.1.3 - Windows NSIS installer" -ForegroundColor Cyan

    # Batch 15.1.4 prepare production release config
    $PrepareReleaseConfig = Join-Path $PSScriptRoot "prepare-release-config.ps1"
    $ReleaseConfigFile = Join-Path $DesktopDir ".release-config\release-config.json"

    if (-not [string]::IsNullOrWhiteSpace([string]$env:AI_TRANSLATOR_PRODUCTION_BACKEND_URL)) {
        & powershell -ExecutionPolicy Bypass -File $PrepareReleaseConfig `
            -DesktopDir $DesktopDir `
            -BackendUrl $env:AI_TRANSLATOR_PRODUCTION_BACKEND_URL
        if ($LASTEXITCODE -ne 0) {
            throw "Production release config generation failed."
        }
    }
    elseif (-not (Test-Path $ReleaseConfigFile -PathType Leaf)) {
        throw @"
Production release config is missing.

Set:
  `$env:AI_TRANSLATOR_PRODUCTION_BACKEND_URL = "https://api.example.com"

Then run this packaging command again.
"@
    }
    if (-not $SkipInputCheck) {
        & powershell -ExecutionPolicy Bypass -File $VerifyInputs -DesktopDir $DesktopDir
        if ($LASTEXITCODE -ne 0) { throw "Packaging input verification failed." }
    }

    if (-not (Test-Path $Builder -PathType Leaf)) {
        throw "electron-builder is not installed. Run npm install in desktop."
    }
    if (-not (Test-Path $BuilderConfig -PathType Leaf)) {
        throw "electron-builder.yml not found: $BuilderConfig"
    }

    if (-not $SkipUnpackedBuild) {
        Write-Host "Building and verifying win-unpacked first..."
        & npm run package:dir
        if ($LASTEXITCODE -ne 0) { throw "win-unpacked build failed (exit code $LASTEXITCODE)." }
    }

    if (-not (Test-Path $AppDir -PathType Container)) {
        throw "Verified win-unpacked payload not found: $AppDir"
    }

    # Re-run layout gate even when -SkipUnpackedBuild is used.
    & powershell -ExecutionPolicy Bypass -File $VerifyPackaged -DesktopDir $DesktopDir -AppDir $AppDir
    if ($LASTEXITCODE -ne 0) { throw "win-unpacked verification failed." }

    if (-not $KeepPreviousInstaller) {
        Get-ChildItem $ReleaseDir -File -Filter "AI-Translator-Setup-*.exe" -ErrorAction SilentlyContinue | Remove-Item -Force
        Get-ChildItem $ReleaseDir -File -Filter "AI-Translator-Setup-*.exe.blockmap" -ErrorAction SilentlyContinue | Remove-Item -Force
    }

    Invoke-ExplicitNsisBuild

    & powershell -ExecutionPolicy Bypass -File $VerifyInstaller -DesktopDir $DesktopDir
    if ($LASTEXITCODE -ne 0) { throw "Installer artifact verification failed." }

    Write-Host ""
    Write-Host "Batch 15.1.3 NSIS installer PASS." -ForegroundColor Green
    Write-Host "Output directory: $ReleaseDir"
    Write-Host "Next: install the Setup EXE on Windows and run the clean-install checklist before committing."
}
finally {
    Pop-Location
}
