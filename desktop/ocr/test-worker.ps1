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

function Write-ProtocolLine {
    param(
        [System.Diagnostics.Process]$Process,
        [string]$Line
    )

    # Windows PowerShell/.NET Framework ProcessStartInfo does not expose
    # StandardInputEncoding. Write UTF-8 bytes directly so no BOM is emitted.
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $bytes = $utf8NoBom.GetBytes($Line + "`r`n")
    $stream = $Process.StandardInput.BaseStream
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush()
}

try {
    Write-Host "Starting packaged OCR worker..."

    if (-not $process.Start()) {
        throw "Unable to start OCR worker."
    }

    $processStarted = $true

    $startupDeadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    $ready = Read-ProtocolMessage -Process $process -Deadline $startupDeadline

    if ($ready.type -eq "fatal") {
        try {
            [void]$process.WaitForExit(5000)
        }
        catch {
        }

        $stderr = ""

        try {
            $stderr = $process.StandardError.ReadToEnd()
        }
        catch {
        }

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
    $pingJson = @{
        id = $pingId
        action = "ping"
    } | ConvertTo-Json -Compress

    Write-ProtocolLine -Process $process -Line $pingJson

    $pingDeadline = [DateTime]::UtcNow.AddSeconds(15)
    $pong = $null

    while ([DateTime]::UtcNow -lt $pingDeadline) {
        $message = Read-ProtocolMessage -Process $process -Deadline $pingDeadline

        Write-Host ("[OCR protocol] " + ($message | ConvertTo-Json -Compress -Depth 10))

        if ($message.type -eq "fatal") {
            throw "OCR worker fatal message during ping: $($message.error)"
        }

        if ($message.type -eq "result" -and $message.id -eq $pingId) {
            $pong = $message
            break
        }

        if ($message.type -eq "result" -and -not $message.success) {
            throw "OCR worker returned an unexpected error during ping: $($message.error)"
        }
    }

    if ($null -eq $pong) {
        throw "OCR worker ping response was not received."
    }

    if (-not $pong.success) {
        throw "OCR worker ping returned success=false. Error: $($pong.error)"
    }

    if (-not $pong.result.pong) {
        throw ("OCR worker ping response did not contain result.pong=true. " + ($pong | ConvertTo-Json -Compress -Depth 10))
    }

    Write-Host "OCR worker ping OK"

    Write-ProtocolLine -Process $process -Line '{"action":"shutdown"}'

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
        }
        catch {
        }
    }

    $process.Dispose()

    if (Test-Path $cacheDir) {
        Remove-Item -Recurse -Force $cacheDir -ErrorAction SilentlyContinue
    }
}
