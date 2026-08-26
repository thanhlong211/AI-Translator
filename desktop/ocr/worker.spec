# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path
import sysconfig

from PyInstaller.utils.hooks import collect_all, copy_metadata

SPEC_DIR = Path(SPEC).resolve().parent
WORKER = SPEC_DIR / "worker.py"
SITE_PACKAGES = Path(sysconfig.get_paths()["purelib"])

datas = []
binaries = []
hiddenimports = []


def collect_package(package: str) -> None:
    """Collect packages Paddle/PaddleOCR/PaddleX may import dynamically."""
    try:
        package_datas, package_binaries, package_hidden = collect_all(package)
    except Exception as error:
        print(f"[worker.spec] optional collect skipped for {package}: {error}")
        return

    datas.extend(package_datas)
    binaries.extend(package_binaries)
    hiddenimports.extend(package_hidden)


def collect_distribution_metadata(distribution: str, recursive: bool = False) -> None:
    """Use PyInstaller metadata collection for primary distributions."""
    try:
        datas.extend(copy_metadata(distribution, recursive=recursive))
    except Exception as error:
        print(
            f"[worker.spec] metadata collect skipped "
            f"for {distribution}: {error}"
        )


def force_dist_info(*patterns: str) -> None:
    """
    Copy only matching dist-info folders directly from site-packages.

    PaddleX validates OCR optional extras at runtime with importlib.metadata.
    In this frozen build, copy_metadata() alone was not preserving the OCR-core
    dependency metadata, so explicitly include only the required dist-info
    directories instead of sweeping every package metadata folder.
    """
    matched = False

    for pattern in patterns:
        for metadata_dir in SITE_PACKAGES.glob(pattern):
            if not metadata_dir.is_dir():
                continue

            print(f"[worker.spec] force metadata: {metadata_dir.name}")
            datas.append((str(metadata_dir), metadata_dir.name))
            matched = True

    if not matched:
        print(
            "[worker.spec] WARNING: no dist-info matched: "
            + ", ".join(patterns)
        )


# ---------------------------------------------------------------------------
# Core OCR runtime
# ---------------------------------------------------------------------------

# Keep the broad core collections for now.  We will trim Paddle/PaddleX only
# after the packaged runtime passes diagnostics, startup and a real OCR test.
for package in (
    "paddle",
    "paddleocr",
    "paddlex",
):
    collect_package(package)


# PaddleX loads these OCR-core modules dynamically.  Explicit top-level imports
# allow PyInstaller's normal hooks to include their actual runtime code and
# native libraries without collect_all() pulling entire test/helper trees.
hiddenimports.extend([
    "imagesize",
    "cv2",
    "pyclipper",
    "pypdfium2",
    "bidi",
    "shapely",
])


# Primary package metadata.
for distribution in (
    "paddlepaddle",
    "paddleocr",
    "paddlex",
):
    collect_distribution_metadata(distribution, recursive=True)


# ---------------------------------------------------------------------------
# PaddleX OCR-core dependency metadata
# ---------------------------------------------------------------------------
# IMPORTANT:
# Distribution names and dist-info folder names can differ:
#   opencv-contrib-python -> opencv_contrib_python-*.dist-info
#   python-bidi           -> python_bidi-*.dist-info
#
# Keep ONLY these six dependency metadata folders.  Do not restore the old
# "*.dist-info" sweep; that unnecessarily bundled metadata for the whole venv.
force_dist_info("imagesize-*.dist-info")
force_dist_info(
    "opencv_contrib_python-*.dist-info",
    "opencv-contrib-python-*.dist-info",
)
force_dist_info("pyclipper-*.dist-info")
force_dist_info("pypdfium2-*.dist-info")
force_dist_info(
    "python_bidi-*.dist-info",
    "python-bidi-*.dist-info",
)
force_dist_info(
    "shapely-*.dist-info",
    "Shapely-*.dist-info",
)


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
