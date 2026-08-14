# AI Translator OCR Worker Production Runtime

Batch 15 moves OCR from ad-hoc child-process handling into a managed worker lifecycle.

## Development setup on Windows

From the `desktop` directory:

```powershell
powershell -ExecutionPolicy Bypass -File .\ocr\prepare-runtime.ps1
```

The script creates `ocr/.venv`, installs the validated PaddleOCR/PaddlePaddle versions, runs diagnostics, and warms the Japanese OCR model.

If Python 3.11 is not available through `py -3.11`, pass another launcher:

```powershell
.\ocr\prepare-runtime.ps1 -Python "C:\Python311\python.exe"
```

## Optional runtime overrides

These are intended for development/diagnostics. Normal users should use the bundled runtime.

- `AI_TRANSLATOR_OCR_PYTHON`: explicit Python executable.
- `AI_TRANSLATOR_OCR_STARTUP_TIMEOUT_MS`: model startup timeout, default 180000 ms.
- `AI_TRANSLATOR_OCR_REQUEST_TIMEOUT_MS`: OCR request timeout, default 90000 ms.
- `AI_TRANSLATOR_OCR_MAX_QUEUE`: maximum outstanding OCR jobs, default 24.
- `AI_TRANSLATOR_OCR_MAX_RESTARTS`: automatic restart budget per minute, default 5.

## Runtime behavior

- PaddleOCR is initialized once and kept warm.
- OCR jobs are serialized through a bounded queue.
- A timed-out or crashed worker is recycled automatically.
- One OCR job is retried once after worker failure/timeout because OCR is read-only and idempotent.
- Repeated crashes are rate-limited to avoid an infinite restart loop.
- Settings > Advanced shows OCR health and exposes a manual restart action.
- Absolute image paths are not exposed through the Settings health response.

## Packaging note

Batch 15 prepares a production-safe worker lifecycle. Batch 15.1 should package the prepared OCR runtime under `resources/ocr` and wire it into the installer/auto-update pipeline. The Electron runtime resolver already supports `process.resourcesPath/ocr` and a future `ocr/runtime/python` layout.
