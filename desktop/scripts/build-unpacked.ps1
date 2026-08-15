param(
    [switch]$SkipRendererBuild,
    [switch]$SkipInputCheck,
    [switch]$LaunchSmoke,
    [switch]$NoClean
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$DesktopDir = Split-Path -Parent $PSScriptRoot
$DesktopDir = (Resolve-Path $DesktopDir).Path
$Builder = Join-Path $DesktopDir "node_modules\.bin\electron-builder.cmd"
$BuilderConfig = Join-Path $DesktopDir "electron-builder.yml"
$PackageJson = Join-Path $DesktopDir "package.json"
$ReleaseDir = Join-Path $DesktopDir "release"
$VerifyInputs = Join-Path $PSScriptRoot "verify-packaging-inputs.ps1"
$VerifyPackaged = Join-Path $PSScriptRoot "verify-packaged-app.ps1"

if ($env:OS -ne "Windows_NT") {
    throw "Batch 15.1.2 Windows package must be built on Windows."
}

function Remove-PropertyIfPresent {
    param(
        [object]$Object,
        [string]$Name
    )

    if ($null -eq $Object) { return $false }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $false }
    $Object.PSObject.Properties.Remove($Name)
    return $true
}

function Invoke-BuilderWithIsolatedExtraResources {
    # electron-builder can merge package.json#build with the external config.
    # A legacy build.extraResources rule that points at the whole `ocr` folder
    # would therefore leak .venv/.build/worker.py into resources/ocr even though
    # electron-builder.yml correctly copies only ocr/runtime.
    #
    # Temporarily remove ONLY extraResources from package.json build scopes,
    # invoke the explicit Batch 15.1.2 config, then restore package.json byte-for-byte.
    $originalPackageBytes = [System.IO.File]::ReadAllBytes($PackageJson)
    $sanitized = $false

    try {
        $pkg = Get-Content $PackageJson -Raw | ConvertFrom-Json
        if ($pkg.PSObject.Properties["build"] -and $null -ne $pkg.build) {
            if (Remove-PropertyIfPresent $pkg.build "extraResources") {
                Write-Host "Ignoring legacy package.json#build.extraResources for this production build." -ForegroundColor Yellow
                $sanitized = $true
            }

            if ($pkg.build.PSObject.Properties["win"] -and $null -ne $pkg.build.win) {
                if (Remove-PropertyIfPresent $pkg.build.win "extraResources") {
                    Write-Host "Ignoring legacy package.json#build.win.extraResources for this production build." -ForegroundColor Yellow
                    $sanitized = $true
                }
            }
        }

        if ($sanitized) {
            $json = $pkg | ConvertTo-Json -Depth 100
            $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
            [System.IO.File]::WriteAllText(
                $PackageJson,
                $json + [Environment]::NewLine,
                $utf8NoBom
            )
        }

        Write-Host "Packaging win-unpacked x64 using explicit electron-builder.yml..."
        & $Builder --config $BuilderConfig --win --x64 --dir --publish never
        if ($LASTEXITCODE -ne 0) {
            throw "electron-builder failed (exit code $LASTEXITCODE)."
        }
    }
    finally {
        if ($sanitized) {
            [System.IO.File]::WriteAllBytes($PackageJson, $originalPackageBytes)
            Write-Host "Restored original package.json." -ForegroundColor DarkGray
        }
    }
}

Push-Location $DesktopDir
try {
    Write-Host "[AI Translator] Batch 15.1.2.3 - deterministic Electron unpacked Windows x64 build" -ForegroundColor Cyan

    if (-not $SkipInputCheck) {
        & powershell -ExecutionPolicy Bypass -File $VerifyInputs -DesktopDir $DesktopDir
        if ($LASTEXITCODE -ne 0) { throw "Packaging input verification failed." }
    }

    if (-not (Test-Path $Builder)) {
        throw "electron-builder is not installed. Run npm install in desktop."
    }
    if (-not (Test-Path $BuilderConfig)) {
        throw "electron-builder.yml not found: $BuilderConfig"
    }
    if (-not (Test-Path $PackageJson)) {
        throw "package.json not found: $PackageJson"
    }

    if (-not $SkipRendererBuild) {
        Write-Host "Building renderer..."
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "Renderer build failed (exit code $LASTEXITCODE)." }
    }

    $distIndex = Join-Path $DesktopDir "dist\index.html"
    if (-not (Test-Path $distIndex)) {
        throw "dist/index.html not found after renderer build."
    }

    if (-not $NoClean -and (Test-Path $ReleaseDir)) {
        Write-Host "Cleaning previous release directory..."
        Remove-Item $ReleaseDir -Recurse -Force
    }

    Invoke-BuilderWithIsolatedExtraResources

    $verifyArgs = @(
        "-ExecutionPolicy", "Bypass",
        "-File", $VerifyPackaged,
        "-DesktopDir", $DesktopDir
    )
    if ($LaunchSmoke) { $verifyArgs += "-LaunchSmoke" }
    & powershell @verifyArgs
    if ($LASTEXITCODE -ne 0) { throw "Packaged app verification failed." }

    Write-Host ""
    Write-Host "Batch 15.1.2 unpacked package PASS." -ForegroundColor Green
    Write-Host "Output: $(Join-Path $ReleaseDir 'win-unpacked')"
    Write-Host "Next: test Manga, PDF OCR, login and tray from AI Translator.exe before Batch 15.1.3 NSIS installer."
}
finally {
    Pop-Location
}
