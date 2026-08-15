param(
    [string]$RuntimeDir = "",
    [int]$TimeoutSeconds = 240
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$OcrDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($RuntimeDir)) {
    $RuntimeDir = Join-Path $OcrDir "runtime"
}

$RuntimeDir = [IO.Path]::GetFullPath($RuntimeDir)
$WorkerExe = Join-Path (Join-Path $RuntimeDir "worker") "ai-translator-ocr-worker.exe"
$ModelRoot = Join-Path $RuntimeDir "models"
$DetectionModel = Join-Path $ModelRoot "PP-OCRv6_medium_det"
$RecognitionModel = Join-Path $ModelRoot "PP-OCRv6_medium_rec"
$Marker = "__OCR_JSON__"

foreach ($required in @($WorkerExe, $DetectionModel, $RecognitionModel)) {
    if (-not (Test-Path $required)) {
        throw "Missing OCR runtime component: $required"
    }
}

$cacheDir = Join-Path $env:TEMP ("AITranslatorOcrSmoke-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = $WorkerExe
$startInfo.WorkingDirectory = Split-Path -Parent $WorkerExe
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$startInfo.RedirectStandardInput = $true
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true
$startInfo.EnvironmentVariables["AI_TRANSLATOR_OCR_MODEL_ROOT"] = $ModelRoot
$startInfo.EnvironmentVariables["PADDLE_PDX_CACHE_HOME"] = $cacheDir
$startInfo.EnvironmentVariables["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"
$startInfo.EnvironmentVariables["PYTHONUTF8"] = "1"
$startInfo.EnvironmentVariables["PYTHONIOENCODING"] = "utf-8"

$process = New-Object System.Diagnostics.Process
$process.StartInfo = $startInfo
$processStarted = $false

function Read-ProtocolMessage {
    param(
        [System.Diagnostics.Process]$Process,
        [DateTime]$Deadline
    )

    $task = $Process.StandardOutput.ReadLineAsync()
    while ([DateTime]::UtcNow -lt $Deadline) {
        if (-not $task.Wait(1000)) {
            if ($Process.HasExited) {
                $stderr = $Process.StandardError.ReadToEnd()
                throw "OCR worker exited early ($($Process.ExitCode)). $stderr"
            }
            continue
        }

        $line = $task.Result
        if ($null -eq $line) {
            if ($Process.HasExited) {
                $stderr = $Process.StandardError.ReadToEnd()
                throw "OCR worker closed stdout ($($Process.ExitCode)). $stderr"
            }
            $task = $Process.StandardOutput.ReadLineAsync()
            continue
        }

        if (-not $line.StartsWith($Marker)) {
            if (-not [string]::IsNullOrWhiteSpace($line)) {
                Write-Host "[worker] $line"
            }
            $task = $Process.StandardOutput.ReadLineAsync()
            continue
        }

        return ($line.Substring($Marker.Length) | ConvertFrom-Json)
    }

    throw "Timed out waiting for OCR worker protocol message."
}

try {
    Write-Host "Starting packaged OCR worker..."
    if (-not $process.Start()) {
        throw "Unable to start OCR worker."
    }
    $processStarted = $true

    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    $ready = Read-ProtocolMessage -Process $process -Deadline $deadline

    if ($ready.type -eq "fatal") {
        # The worker emits a structured fatal message before exiting. Drain the
        # redirected stderr as well so PyInstaller/PaddleX tracebacks are not
        # hidden behind the short protocol error.
        try { [void]$process.WaitForExit(5000) } catch { }
        $stderr = ""
        try { $stderr = $process.StandardError.ReadToEnd() } catch { }
        if (-not [string]::IsNullOrWhiteSpace($stderr)) {
            Write-Host "--- OCR worker stderr ---" -ForegroundColor Yellow
            Write-Host $stderr
            Write-Host "--- end OCR worker stderr ---" -ForegroundColor Yellow
        }
        throw "OCR worker fatal startup: $($ready.error)"
    }
    if ($ready.type -ne "ready") {
        throw "Expected ready message, received: $($ready.type)"
    }
    if ([int]$ready.protocol -ne 2) {
        throw "OCR protocol mismatch. Expected 2, received $($ready.protocol)."
    }

    Write-Host "Worker ready: PaddleOCR $($ready.paddleOcrVersion), PaddlePaddle $($ready.paddlePaddleVersion), startup $($ready.startupMs) ms"

    $pingId = "smoke-ping"
    $process.StandardInput.WriteLine((@{
        id = $pingId
        action = "ping"
    } | ConvertTo-Json -Compress))
    $process.StandardInput.Flush()

    $pong = Read-ProtocolMessage -Process $process -Deadline $deadline
    if ($pong.type -ne "result" -or -not $pong.success -or $pong.id -ne $pingId -or -not $pong.result.pong) {
        throw "OCR worker ping failed."
    }

    $process.StandardInput.WriteLine('{"action":"shutdown"}')
    $process.StandardInput.Flush()

    if (-not $process.WaitForExit(15000)) {
        $process.Kill()
        throw "OCR worker did not exit after shutdown."
    }

    if ($process.ExitCode -ne 0) {
        $stderr = $process.StandardError.ReadToEnd()
        throw "OCR worker exited with code $($process.ExitCode). $stderr"
    }

    Write-Host "OCR worker protocol smoke test PASS." -ForegroundColor Green
}
finally {
    if ($processStarted) {
        try {
            if (-not $process.HasExited) {
                $process.Kill()
            }
        } catch { }
    }
    $process.Dispose()
    if (Test-Path $cacheDir) {
        Remove-Item -Recurse -Force $cacheDir -ErrorAction SilentlyContinue
    }
}
