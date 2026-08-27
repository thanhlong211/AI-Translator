param(
    [switch]$SkipDependencyInstall,
    [switch]$SkipModelDownload,
    [switch]$SkipSmokeTest,
    [switch]$NoClean
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$OcrDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPython = Join-Path $OcrDir ".venv\Scripts\python.exe"
$PrepareRuntime = Join-Path $OcrDir "prepare-runtime.ps1"
$BuildRequirements = Join-Path $OcrDir "requirements-worker-build.txt"
$SpecFile = Join-Path $OcrDir "worker.spec"
$BuildDir = Join-Path $OcrDir ".build"
$PaddlexCache = Join-Path $BuildDir "paddlex-cache"
$DistDir = Join-Path $BuildDir "dist"
$WorkDir = Join-Path $BuildDir "pyinstaller-work"
$RuntimeDir = Join-Path $OcrDir "runtime"
$WorkerRuntimeDir = Join-Path $RuntimeDir "worker"
$ModelsRuntimeDir = Join-Path $RuntimeDir "models"
$WorkerExe = Join-Path $WorkerRuntimeDir "ai-translator-ocr-worker.exe"
$TestScript = Join-Path $OcrDir "test-worker.ps1"

$DetectionModelName = "PP-OCRv6_small_det"
$RecognitionModelName = "PP-OCRv6_small_rec"

function Assert-LastExitCode {
    param([string]$Message)
    if ($LASTEXITCODE -ne 0) {
        throw "$Message (exit code $LASTEXITCODE)."
    }
}

function Get-PythonPackageVersion {
    param([string]$Distribution)
    $value = & $VenvPython -c "import importlib.metadata as m; print(m.version('$Distribution'))"
    if ($LASTEXITCODE -ne 0) {
        return "unknown"
    }
    return ($value | Select-Object -Last 1).Trim()
}

Write-Host "[AI Translator] Batch 15.1.1.1 - building OCR worker.exe" -ForegroundColor Cyan

$isWindowsPlatform = $env:OS -eq "Windows_NT"
if (-not $isWindowsPlatform) {
    throw "OCR worker.exe must be built on Windows x64."
}

if (-not (Test-Path $VenvPython)) {
    if (-not (Test-Path $PrepareRuntime)) {
        throw "Missing OCR development runtime and prepare-runtime.ps1."
    }

    Write-Host "OCR .venv not found. Preparing validated Python runtime first..."
    & powershell -ExecutionPolicy Bypass -File $PrepareRuntime
    Assert-LastExitCode "prepare-runtime.ps1 failed"
}

if (-not (Test-Path $VenvPython)) {
    throw "Python 3.11 OCR runtime not found: $VenvPython"
}

if (-not $SkipDependencyInstall) {
    Write-Host "Installing worker build dependency..."
    & $VenvPython -m pip install -r $BuildRequirements
    Assert-LastExitCode "PyInstaller dependency installation failed"
}

Write-Host "Validating development OCR environment..."
& $VenvPython -m pip check
Assert-LastExitCode "OCR development environment has broken dependencies"

if (-not $NoClean) {
    foreach ($target in @($DistDir, $WorkDir, $WorkerRuntimeDir, $ModelsRuntimeDir)) {
        if (Test-Path $target) {
            Remove-Item -Recurse -Force $target
        }
    }
}

New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null
New-Item -ItemType Directory -Force -Path $PaddlexCache | Out-Null
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

$env:PADDLE_PDX_CACHE_HOME = $PaddlexCache
$env:PADDLE_PDX_MODEL_SOURCE = "BOS"
$env:PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK = "True"
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"

$DetectionCacheDir = Join-Path (Join-Path $PaddlexCache "official_models") $DetectionModelName
$RecognitionCacheDir = Join-Path (Join-Path $PaddlexCache "official_models") $RecognitionModelName

if (-not $SkipModelDownload) {
    Write-Host "Preparing pinned Japanese OCR models in isolated build cache..."
    $warmup = @"
from paddleocr import PaddleOCR
ocr = PaddleOCR(
    lang='japan',
    text_detection_model_name='PP-OCRv6_small_det',
    text_recognition_model_name='PP-OCRv6_small_rec',
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
)
print('OCR model warmup OK')
"@
    & $VenvPython -X utf8 -c $warmup
    Assert-LastExitCode "OCR model warmup/download failed"
}

if (-not (Test-Path $DetectionCacheDir)) {
    throw "Missing detection model after warmup: $DetectionCacheDir"
}
if (-not (Test-Path $RecognitionCacheDir)) {
    throw "Missing recognition model after warmup: $RecognitionCacheDir"
}

Write-Host "Validating local-model pipeline before freezing..."
$env:AI_TRANSLATOR_OCR_MODEL_ROOT = Join-Path $BuildDir "paddlex-cache\official_models"
$localModelProbe = @"
from paddleocr import PaddleOCR
ocr = PaddleOCR(
    text_detection_model_name='PP-OCRv6_small_det',
    text_detection_model_dir=r'$DetectionCacheDir',
    text_recognition_model_name='PP-OCRv6_small_rec',
    text_recognition_model_dir=r'$RecognitionCacheDir',
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
)
print('Local-model pipeline creation OK')
"@
& $VenvPython -X utf8 -c $localModelProbe
Assert-LastExitCode "Local-model OCR pipeline preflight failed"
Remove-Item Env:AI_TRANSLATOR_OCR_MODEL_ROOT -ErrorAction SilentlyContinue

Write-Host "Building PyInstaller onedir worker with OCR extra metadata..."
New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null

& $VenvPython -m PyInstaller `
    --noconfirm `
    --clean `
    --distpath $DistDir `
    --workpath $WorkDir `
    $SpecFile
Assert-LastExitCode "PyInstaller worker build failed"

$BuiltWorkerDir = Join-Path $DistDir "ai-translator-ocr-worker"
$BuiltWorkerExe = Join-Path $BuiltWorkerDir "ai-translator-ocr-worker.exe"
if (-not (Test-Path $BuiltWorkerExe)) {
    throw "PyInstaller finished but worker executable was not found: $BuiltWorkerExe"
}

Write-Host "Assembling production runtime..."
New-Item -ItemType Directory -Force -Path $WorkerRuntimeDir | Out-Null
New-Item -ItemType Directory -Force -Path $ModelsRuntimeDir | Out-Null
Copy-Item -Path (Join-Path $BuiltWorkerDir "*") -Destination $WorkerRuntimeDir -Recurse -Force
Copy-Item -Path $DetectionCacheDir -Destination (Join-Path $ModelsRuntimeDir $DetectionModelName) -Recurse -Force
Copy-Item -Path $RecognitionCacheDir -Destination (Join-Path $ModelsRuntimeDir $RecognitionModelName) -Recurse -Force

$paddleOcrVersion = Get-PythonPackageVersion "paddleocr"
$paddlePaddleVersion = Get-PythonPackageVersion "paddlepaddle"
$paddleXVersion = Get-PythonPackageVersion "paddlex"
$pyInstallerVersion = Get-PythonPackageVersion "pyinstaller"
$pythonVersion = (& $VenvPython -c "import sys; print(sys.version.split()[0])" | Select-Object -Last 1).Trim()

$manifest = [ordered]@{
    schemaVersion = 2
    protocol = 2
    worker = "ai-translator-ocr-worker.exe"
    layout = "pyinstaller-onedir"
    platform = "win32-x64"
    python = $pythonVersion
    paddleocr = $paddleOcrVersion
    paddlepaddle = $paddlePaddleVersion
    paddlex = $paddleXVersion
    pyinstaller = $pyInstallerVersion
    dependencyMetadata = "full-build-environment"
    models = @($DetectionModelName, $RecognitionModelName)
    builtAtUtc = [DateTime]::UtcNow.ToString("o")
}

$manifest | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 (Join-Path $RuntimeDir "manifest.json")

Write-Host "Running worker diagnostics..."
$env:AI_TRANSLATOR_OCR_MODEL_ROOT = $ModelsRuntimeDir
$diagnostics = & $WorkerExe --diagnostics
Assert-LastExitCode "Packaged worker diagnostics failed"
$diagnostics | ForEach-Object { Write-Host $_ }

$diagnosticLine = $diagnostics | Where-Object { $_ -like "__OCR_JSON__*" } | Select-Object -Last 1
if ($diagnosticLine) {
    $diagnosticJson = $diagnosticLine.Substring("__OCR_JSON__".Length) | ConvertFrom-Json
    $missing = @($diagnosticJson.dependencyCheck.missing)
    if ($missing.Count -gt 0) {
        throw "Packaged worker is missing PaddleX OCR dependencies: $($missing -join ', ')"
    }
}

if (-not $SkipSmokeTest) {
    Write-Host "Running protocol/startup smoke test..."
    & powershell -ExecutionPolicy Bypass -File $TestScript -RuntimeDir $RuntimeDir
    Assert-LastExitCode "Packaged worker smoke test failed"
}

$workerBytes = (Get-ChildItem $WorkerRuntimeDir -File -Recurse | Measure-Object Length -Sum).Sum
$modelBytes = (Get-ChildItem $ModelsRuntimeDir -File -Recurse | Measure-Object Length -Sum).Sum
$workerMb = [Math]::Round($workerBytes / 1MB, 1)
$modelMb = [Math]::Round($modelBytes / 1MB, 1)

Write-Host ""
Write-Host "OCR production runtime ready." -ForegroundColor Green
Write-Host "Worker: $WorkerExe"
Write-Host "Worker bundle: $workerMb MB"
Write-Host "Models: $modelMb MB"
Write-Host "Runtime root: $RuntimeDir"
Write-Host ""
Write-Host "Do not commit desktop/ocr/runtime or desktop/ocr/.venv. Batch 15.1.2 will copy runtime into Electron resources during packaging."
