$ErrorActionPreference = "Stop"

Write-Host "AI Translator Git preflight" -ForegroundColor Cyan
Write-Host "Repository: $((Get-Location).Path)"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Git is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path ".gitignore")) {
    Write-Host "ERROR: .gitignore not found. Run this script from AI-Translator root." -ForegroundColor Red
    exit 1
}

$expected = @("desktop", "backend")
foreach ($folder in $expected) {
    if (-not (Test-Path $folder)) {
        Write-Host "WARNING: expected folder '$folder' was not found." -ForegroundColor Yellow
    }
}

Write-Host "`n[1/4] Checking dangerous directories..." -ForegroundColor Cyan
$dangerDirs = @(
    "desktop/node_modules",
    "desktop/ocr/.venv",
    "desktop/dist",
    "desktop/runtime",
    "backend/target"
)
foreach ($path in $dangerDirs) {
    if (Test-Path $path) {
        $ignored = git check-ignore $path 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  OK ignored: $path" -ForegroundColor Green
        } else {
            Write-Host "  ERROR not ignored: $path" -ForegroundColor Red
        }
    }
}

Write-Host "`n[2/4] Looking for local secret/config files..." -ForegroundColor Cyan
$secretFiles = Get-ChildItem -Path . -Recurse -Force -File -ErrorAction SilentlyContinue |
    Where-Object {
        $_.FullName -notmatch "[\\/](node_modules|\.venv|target|dist|\.git)[\\/]" -and (
            $_.Name -eq ".env" -or
            $_.Name -like ".env.*" -or
            $_.Name -match "application-(local|secrets).*\.(properties|ya?ml)$" -or
            $_.Extension -in @(".pem", ".key", ".p12", ".pfx", ".jks")
        )
    }

if ($secretFiles) {
    foreach ($file in $secretFiles) {
        $relative = Resolve-Path -Relative $file.FullName
        $ignored = git check-ignore $relative 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  OK ignored: $relative" -ForegroundColor Green
        } else {
            Write-Host "  REVIEW NOT IGNORED: $relative" -ForegroundColor Red
        }
    }
} else {
    Write-Host "  No local secret/config files found by filename scan." -ForegroundColor Green
}

Write-Host "`n[3/4] Looking for large source candidates (> 25 MB)..." -ForegroundColor Cyan
$largeFiles = Get-ChildItem -Path . -Recurse -Force -File -ErrorAction SilentlyContinue |
    Where-Object {
        $_.Length -gt 25MB -and
        $_.FullName -notmatch "[\\/](node_modules|\.venv|target|dist|\.git)[\\/]"
    } |
    Sort-Object Length -Descending

if ($largeFiles) {
    foreach ($file in $largeFiles) {
        $mb = [math]::Round($file.Length / 1MB, 1)
        $relative = Resolve-Path -Relative $file.FullName
        $ignored = git check-ignore $relative 2>$null
        $status = if ($LASTEXITCODE -eq 0) { "ignored" } else { "REVIEW" }
        Write-Host "  $status ${mb}MB $relative" -ForegroundColor $(if ($status -eq "ignored") { "Green" } else { "Yellow" })
    }
} else {
    Write-Host "  No non-build files over 25 MB found." -ForegroundColor Green
}

Write-Host "`n[4/4] Git status summary..." -ForegroundColor Cyan
if (Test-Path ".git") {
    git status --short
} else {
    Write-Host "  Git is not initialized yet. Next command: git init" -ForegroundColor Yellow
}

Write-Host "`nPreflight finished." -ForegroundColor Cyan
Write-Host "Do not run git commit until you have reviewed 'git status' after staging." -ForegroundColor Yellow
