param(
    [string]$DesktopDir = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

if (-not $DesktopDir) {
    $DesktopDir = Split-Path -Parent $PSScriptRoot
}
$DesktopDir = (Resolve-Path $DesktopDir).Path
$DistIndex = Join-Path $DesktopDir "dist\index.html"

if (-not (Test-Path $DistIndex -PathType Leaf)) {
    throw "dist/index.html not found: $DistIndex"
}

$html = Get-Content $DistIndex -Raw

# Root-absolute src/href values resolve against file:///C:/ when Electron uses loadFile().
# The packaged renderer therefore requires relative asset URLs.
$absoluteMatches = [regex]::Matches(
    $html,
    '(?i)(?:src|href)\s*=\s*["'']/[^/][^"'']*["'']'
)
if ($absoluteMatches.Count -gt 0) {
    $examples = @($absoluteMatches | Select-Object -First 5 | ForEach-Object { $_.Value }) -join '; '
    throw "Renderer build contains root-absolute asset URL(s), which break Electron file:// loading: $examples"
}

$moduleScript = [regex]::Match(
    $html,
    '(?i)<script[^>]+type=["'']module["''][^>]+src=["''](?<url>[^"'']+)["'']'
)
if (-not $moduleScript.Success) {
    throw "No Vite module script was found in dist/index.html."
}

$moduleUrl = $moduleScript.Groups['url'].Value
if ($moduleUrl.StartsWith('/')) {
    throw "Vite module script is not relative: $moduleUrl"
}

Write-Host "Renderer build file-protocol PASS." -ForegroundColor Green
Write-Host "dist/index.html: $DistIndex"
Write-Host "module: $moduleUrl"
