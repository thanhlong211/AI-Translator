# AI Translator OCR Production Runtime

Batch 15.1.1 packages the managed OCR protocol-v2 worker as a Windows executable and keeps OCR models beside the executable as installer resources. End-user machines do not need Python installed.

## Runtime layout

After `build-worker.ps1` succeeds:

```text
ocr/runtime/
├─ manifest.json
├─ worker/
│  ├─ ai-translator-ocr-worker.exe
│  └─ _internal/...
└─ models/
   ├─ PP-OCRv6_medium_det/
   └─ PP-OCRv6_medium_rec/
```

The worker is intentionally built with PyInstaller `onedir`, not `onefile`. Paddle/PaddleOCR/PaddleX include native libraries and package data; keeping the one-folder bundle avoids extracting a large Python runtime on every worker start and gives the installer a deterministic resource tree.

`ocr/runtime/` is generated output and is ignored by Git. Batch 15.1.2 should copy this directory into Electron `resources/ocr/runtime` during packaging.

## Development OCR setup

From `desktop`:

```powershell
powershell -ExecutionPolicy Bypass -File .\ocr\prepare-runtime.ps1
```

This creates `ocr/.venv` with the pinned OCR dependencies. `.venv` is development-only and must not be shipped in the installer.

## Build worker.exe

Build on Windows x64 after the development OCR runtime works:

```powershell
cd C:\Users\dangt\AI-Translator\desktop
powershell -ExecutionPolicy Bypass -File .\ocr\build-worker.ps1
```

The build performs these steps:

1. Uses `ocr/.venv` (Python 3.11 + pinned PaddleOCR/PaddlePaddle).
2. Installs the build-only PyInstaller dependency.
3. Downloads/warmups the Japanese OCR models into an isolated `.build` cache.
4. Builds `ai-translator-ocr-worker.exe` as a PyInstaller `onedir` application.
5. Copies the exact OCR models used by the current `lang="japan"` pipeline (`PP-OCRv6_medium_det` and `PP-OCRv6_medium_rec`) into `ocr/runtime/models`.
6. Writes `ocr/runtime/manifest.json` with runtime versions.
7. Runs diagnostics and a protocol/startup smoke test.

Useful build switches:

```powershell
# Dependencies already installed
.\ocr\build-worker.ps1 -SkipDependencyInstall

# Reuse models already present in .build/paddlex-cache
.\ocr\build-worker.ps1 -SkipModelDownload

# Assemble without deleting previous build folders first
.\ocr\build-worker.ps1 -NoClean

# Skip startup smoke test while diagnosing packaging
.\ocr\build-worker.ps1 -SkipSmokeTest
```

## Test packaged worker

```powershell
powershell -ExecutionPolicy Bypass -File .\ocr\test-worker.ps1
```

The smoke test verifies:

- `worker.exe` can start without system Python;
- bundled model directories are present;
- protocol version is 2;
- PaddleOCR initializes from the bundled models;
- the stdin/stdout `ping` protocol works;
- graceful shutdown works.

After that, start the Electron desktop normally. `OcrWorkerManager` now resolves OCR runtime in this order on Windows:

1. `AI_TRANSLATOR_OCR_WORKER` override (diagnostics only);
2. `ocr/runtime/worker/ai-translator-ocr-worker.exe`;
3. `AI_TRANSLATOR_OCR_PYTHON` override (development only);
4. legacy portable Python layout `ocr/runtime/python/python.exe`;
5. development `.venv/Scripts/python.exe`.

When `worker.exe` is selected, both production model directories are mandatory. The manager passes `AI_TRANSLATOR_OCR_MODEL_ROOT` to the worker and disables model-host connectivity checks, so the installed application does not download OCR models at runtime.

## Runtime overrides

These are intended for development/diagnostics:

- `AI_TRANSLATOR_OCR_WORKER`: explicit packaged worker executable.
- `AI_TRANSLATOR_OCR_PYTHON`: explicit development Python executable.
- `AI_TRANSLATOR_OCR_CACHE_DIR`: writable PaddleX runtime cache/lock directory.
- `AI_TRANSLATOR_OCR_STARTUP_TIMEOUT_MS`: startup timeout, default 180000 ms.
- `AI_TRANSLATOR_OCR_REQUEST_TIMEOUT_MS`: OCR request timeout, default 90000 ms.
- `AI_TRANSLATOR_OCR_MAX_QUEUE`: maximum outstanding OCR jobs, default 24.
- `AI_TRANSLATOR_OCR_MAX_RESTARTS`: automatic restart budget per minute, default 5.

## Production acceptance for Batch 15.1.1

Before committing the generated packaging code:

```text
[ ] build-worker.ps1 completes on Windows x64
[ ] runtime/worker/ai-translator-ocr-worker.exe exists
[ ] runtime/models contains both PP-OCRv6 medium models
[ ] test-worker.ps1 reports PASS
[ ] Desktop Settings OCR health becomes READY
[ ] Manga Ctrl+Shift+Y OCR works
[ ] PDF scanned-page OCR works
[ ] Rename/remove .venv temporarily and confirm worker.exe still works
[ ] Disconnect network and confirm OCR still starts and recognizes text
```

Do not commit `ocr/.venv`, `ocr/.build`, or `ocr/runtime`. The runtime artifacts will be regenerated before packaging and embedded into the installer in Batch 15.1.2.

## Batch 15.1.1.1 - frozen dependency metadata hotfix

PaddleX validates the `ocr` / `ocr-core` optional dependency group through
Python distribution metadata before creating the OCR pipeline. The worker spec
therefore preserves build-environment `dist-info` metadata and explicitly
collects the compact OCR-core dynamic packages (`cv2`, `imagesize`,
`pyclipper`, `pypdfium2`, `bidi`, `shapely`).

`build-worker.ps1` now performs three gates before accepting the runtime:

1. `pip check` for the development environment.
2. Creation of the same OCR pipeline with the pinned local model directories.
3. Frozen diagnostics + protocol smoke test, with full stderr on startup failure.
