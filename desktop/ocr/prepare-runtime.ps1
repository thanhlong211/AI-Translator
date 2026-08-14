param(
    [string]$Python = "py -3.11",
    [switch]$SkipWarmup
)

$ErrorActionPreference = "Stop"

$OcrDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvDir = Join-Path $OcrDir ".venv"
$PythonExe = Join-Path $VenvDir "Scripts\python.exe"
$Requirements = Join-Path $OcrDir "requirements-production.txt"
$Worker = Join-Path $OcrDir "worker.py"

function Invoke-PythonLauncher {
    param([string[]]$Arguments)

    $parts = $Python -split "\s+"
    $exe = $parts[0]
    $prefix = @()

    if ($parts.Length -gt 1) {
        $prefix = $parts[1..($parts.Length - 1)]
    }

    & $exe @prefix @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "Python command failed with exit code $LASTEXITCODE."
    }
}

Write-Host "[AI Translator] Preparing OCR runtime..."

if (-not (Test-Path $Requirements)) {
    throw "Missing requirements file: $Requirements"
}

if (-not (Test-Path $VenvDir)) {
    Write-Host "Creating Python 3.11 virtual environment..."
    Invoke-PythonLauncher -Arguments @("-m", "venv", $VenvDir)
}

if (-not (Test-Path $PythonExe)) {
    throw "OCR Python runtime was not created: $PythonExe"
}

Write-Host "Updating pip tooling..."
& $PythonExe -m pip install --upgrade pip setuptools wheel
if ($LASTEXITCODE -ne 0) { throw "pip bootstrap failed." }

Write-Host "Installing pinned OCR dependencies..."
& $PythonExe -m pip install -r $Requirements
if ($LASTEXITCODE -ne 0) { throw "OCR dependency installation failed." }

Write-Host "Checking OCR runtime versions..."
& $PythonExe -X utf8 $Worker --diagnostics
if ($LASTEXITCODE -ne 0) { throw "OCR diagnostics failed." }

if (-not $SkipWarmup) {
    Write-Host "Warming PaddleOCR model. First run may download model files..."
    $env:AI_TRANSLATOR_OCR_WARMUP = "1"
    & $PythonExe -X utf8 -c "from paddleocr import PaddleOCR; PaddleOCR(lang='japan', use_doc_orientation_classify=False, use_doc_unwarping=False, use_textline_orientation=False); print('PaddleOCR warmup OK')"
    if ($LASTEXITCODE -ne 0) { throw "PaddleOCR warmup failed." }
}

Write-Host ""
Write-Host "OCR runtime is ready: $PythonExe" -ForegroundColor Green
