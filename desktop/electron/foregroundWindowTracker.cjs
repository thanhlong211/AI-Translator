const {
  spawn
} = require("child_process");

let trackerProcess = null;
let latestSnapshot = null;

const SNAPSHOT_PREFIX =
  "__FG_WINDOW__";

function buildPowerShellScript() {
  return `
$ErrorActionPreference = "SilentlyContinue"
[Console]::OutputEncoding =
    New-Object System.Text.UTF8Encoding($false)

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class Win32Foreground {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(
        IntPtr hWnd,
        StringBuilder text,
        int count
    );

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(
        IntPtr hWnd,
        out uint processId
    );
}
"@

while ($true) {
    try {
        $hwnd =
            [Win32Foreground]::GetForegroundWindow()

        $builder =
            New-Object System.Text.StringBuilder 1024

        [void] [Win32Foreground]::GetWindowText(
            $hwnd,
            $builder,
            $builder.Capacity
        )

        [uint32] $pidValue = 0

        [void] [Win32Foreground]::GetWindowThreadProcessId(
            $hwnd,
            [ref] $pidValue
        )

        $processName = ""

        if ($pidValue -gt 0) {
            try {
                $processName =
                    (Get-Process -Id $pidValue).ProcessName
            } catch {
                $processName = ""
            }
        }

        $payload = [PSCustomObject]@{
            hwnd = $hwnd.ToInt64().ToString()
            processId = [int] $pidValue
            processName = [string] $processName
            title = [string] $builder.ToString()
            capturedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        }

        $json =
            $payload |
            ConvertTo-Json -Compress

        Write-Output "${SNAPSHOT_PREFIX}$json"
    } catch {
    }

    Start-Sleep -Milliseconds 250
}
`;
}

function startForegroundWindowTracker() {
  if (process.platform !== "win32") {
    console.log(
      "FOREGROUND WINDOW TRACKER: Windows only"
    );

    return false;
  }

  if (
    trackerProcess &&
    !trackerProcess.killed
  ) {
    return true;
  }

  const script =
    buildPowerShellScript();

  trackerProcess =
    spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
      ],
      {
        windowsHide: true,
        stdio: [
          "ignore",
          "pipe",
          "pipe",
        ],
      }
    );

  let stdoutBuffer = "";

  trackerProcess.stdout.on(
    "data",
    (data) => {
      stdoutBuffer +=
        data.toString("utf8");

      const lines =
        stdoutBuffer.split(
          /\r?\n/
        );

      stdoutBuffer =
        lines.pop() || "";

      for (const line of lines) {
        if (
          !line.startsWith(
            SNAPSHOT_PREFIX
          )
        ) {
          continue;
        }

        try {
          latestSnapshot =
            JSON.parse(
              line.slice(
                SNAPSHOT_PREFIX.length
              )
            );
        } catch {
          // Ignore one malformed sample.
        }
      }
    }
  );

  trackerProcess.stderr.on(
    "data",
    (data) => {
      const message =
        data
          .toString("utf8")
          .trim();

      if (message) {
        console.warn(
          "FOREGROUND TRACKER STDERR:",
          message
        );
      }
    }
  );

  trackerProcess.on(
    "error",
    (error) => {
      console.error(
        "FOREGROUND TRACKER ERROR:",
        error
      );

      trackerProcess = null;
    }
  );

  trackerProcess.on(
    "close",
    (code) => {
      console.log(
        "FOREGROUND TRACKER CLOSED:",
        code
      );

      trackerProcess = null;
    }
  );

  console.log(
    "FOREGROUND WINDOW TRACKER READY"
  );

  return true;
}

function stopForegroundWindowTracker() {
  if (
    trackerProcess &&
    !trackerProcess.killed
  ) {
    trackerProcess.kill();
  }

  trackerProcess = null;
}

function getForegroundWindowSnapshot() {
  if (!latestSnapshot) {
    return null;
  }

  return {
    ...latestSnapshot,
  };
}

module.exports = {
  startForegroundWindowTracker,
  stopForegroundWindowTracker,
  getForegroundWindowSnapshot,
};
