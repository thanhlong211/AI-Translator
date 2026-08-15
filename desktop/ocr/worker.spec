# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path
import sysconfig

from PyInstaller.utils.hooks import collect_all, copy_metadata

SPEC_DIR = Path(SPEC).resolve().parent
WORKER = SPEC_DIR / "worker.py"

datas = []
binaries = []
hiddenimports = []


def collect_package(package: str) -> None:
    """Collect a package that PaddleX/PaddleOCR may import dynamically."""
    try:
        package_datas, package_binaries, package_hidden = collect_all(package)
    except Exception as error:
        print(f"[worker.spec] optional collect skipped for {package}: {error}")
        return

    datas.extend(package_datas)
    binaries.extend(package_binaries)
    hiddenimports.extend(package_hidden)


# Paddle/PaddleOCR/PaddleX use plugin-style imports and carry native/data files.
for package in ("paddle", "paddleocr", "paddlex"):
    collect_package(package)

# PaddleX's OCR pipeline is guarded by the `ocr` / `ocr-core` optional extras.
# These imports can be reached dynamically after pipeline registration, so make
# the compact ocr-core set explicit instead of relying only on static analysis.
for package in (
    "imagesize",
    "cv2",
    "pyclipper",
    "pypdfium2",
    "bidi",
    "shapely",
):
    collect_package(package)

# PaddleX checks optional dependencies through importlib.metadata at runtime.
# PyInstaller does not automatically retain every installed dist-info folder,
# especially dependencies that are referenced only through extras markers.
# Keep the OCR build environment's metadata so `paddlex[ocr-core]` can be
# validated inside the frozen executable just as it is in the working .venv.
site_packages = Path(sysconfig.get_paths()["purelib"])
for pattern in ("*.dist-info", "*.egg-info"):
    for metadata_dir in site_packages.glob(pattern):
        datas.append((str(metadata_dir), metadata_dir.name))

# Preserve primary package metadata explicitly as well. This is intentionally
# redundant with the metadata sweep above and makes the requirement clear.
for distribution in ("paddlepaddle", "paddleocr", "paddlex"):
    try:
        datas += copy_metadata(distribution, recursive=True)
    except Exception as error:
        print(f"[worker.spec] metadata collect skipped for {distribution}: {error}")

a = Analysis(
    [str(WORKER)],
    pathex=[str(SPEC_DIR)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

python_options = [
    ("u", None, "OPTION"),
    ("X utf8", None, "OPTION"),
]

exe = EXE(
    pyz,
    a.scripts,
    python_options,
    exclude_binaries=True,
    name="ai-translator-ocr-worker",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="ai-translator-ocr-worker",
)
