import importlib.metadata
import json
import os
import sys
import time
import traceback
from numbers import Number
from pathlib import Path
from typing import Any


# ======================================================
# UTF-8 ON WINDOWS
# ======================================================

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


OUTPUT_MARKER = "__OCR_JSON__"
PROTOCOL_VERSION = 2
MODEL_SOURCE = "development"


def emit(data: dict[str, Any]) -> None:
    output = json.dumps(
        data,
        ensure_ascii=False,
        separators=(",", ":")
    )

    print(
        OUTPUT_MARKER + output,
        flush=True
    )


def package_version(name: str) -> str | None:
    try:
        return importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        return None


def paddlex_dependency_report(extra: str = "ocr-core") -> dict[str, Any]:
    """Report PaddleX extra dependencies visible in this runtime.

    PaddleX validates OCR optional extras through distribution metadata before
    pipeline creation. Frozen apps therefore need both modules and dist-info.
    """
    try:
        from packaging.markers import default_environment
        from packaging.requirements import Requirement
    except Exception as error:
        return {
            "extra": extra,
            "checked": 0,
            "missing": [f"packaging: {error}"],
        }

    try:
        requirements = importlib.metadata.requires("paddlex") or []
    except Exception as error:
        return {
            "extra": extra,
            "checked": 0,
            "missing": [f"paddlex metadata: {error}"],
        }

    environment = default_environment()
    environment["extra"] = extra
    checked: list[str] = []
    missing: list[str] = []

    for raw_requirement in requirements:
        try:
            requirement = Requirement(raw_requirement)
        except Exception:
            continue

        if requirement.marker is not None:
            try:
                if not requirement.marker.evaluate(environment):
                    continue
            except Exception:
                continue

        checked.append(requirement.name)
        try:
            installed = importlib.metadata.version(requirement.name)
            if requirement.specifier and installed not in requirement.specifier:
                missing.append(
                    f"{requirement.name} {installed} !~ {requirement.specifier}"
                )
        except importlib.metadata.PackageNotFoundError:
            missing.append(requirement.name)
        except Exception as error:
            missing.append(f"{requirement.name}: {error}")

    return {
        "extra": extra,
        "checked": len(checked),
        "missing": missing,
    }


def detected_model_source() -> str:
    try:
        model_dirs = production_model_dirs()
    except Exception:
        if getattr(sys, "frozen", False):
            return "bundled-missing"
        return MODEL_SOURCE

    if model_dirs is not None:
        return "bundled"
    if getattr(sys, "frozen", False):
        return "bundled-missing"
    return MODEL_SOURCE


def runtime_metadata(startup_ms: int = 0) -> dict[str, Any]:
    return {
        "protocol": PROTOCOL_VERSION,
        "pid": os.getpid(),
        "pythonVersion": sys.version.split()[0],
        "paddleOcrVersion": package_version("paddleocr"),
        "paddlePaddleVersion": package_version("paddlepaddle"),
        "startupMs": max(0, int(startup_ms)),
        "frozen": bool(getattr(sys, "frozen", False)),
        "modelSource": detected_model_source()
    }


def result_to_dict(result: Any) -> dict[str, Any]:
    data = getattr(result, "json", None)

    if callable(data):
        data = data()

    if isinstance(data, str):
        data = json.loads(data)

    if not isinstance(data, dict):
        raise TypeError(
            "Không đọc được dữ liệu OCR từ PaddleOCR."
        )

    return data


def first_available(
    payload: dict[str, Any],
    keys: list[str]
) -> Any:
    for key in keys:
        value = payload.get(key)

        if value is None:
            continue

        try:
            if len(value) == 0:
                continue
        except TypeError:
            pass

        return value

    return []


def polygon_to_box(polygon: Any) -> dict[str, float]:
    points = []

    for point in polygon:
        if point is None:
            continue

        if len(point) < 2:
            continue

        points.append({
            "x": float(point[0]),
            "y": float(point[1])
        })

    if not points:
        raise ValueError(
            "Polygon không có điểm hợp lệ."
        )

    xs = [point["x"] for point in points]
    ys = [point["y"] for point in points]

    left = min(xs)
    top = min(ys)
    right = max(xs)
    bottom = max(ys)

    return {
        "x": left,
        "y": top,
        "width": max(1.0, right - left),
        "height": max(1.0, bottom - top)
    }


def production_model_root() -> Path | None:
    explicit = os.environ.get("AI_TRANSLATOR_OCR_MODEL_ROOT", "").strip()
    if explicit:
        return Path(explicit).expanduser().resolve()

    if getattr(sys, "frozen", False):
        # PyInstaller onedir layout:
        # runtime/worker/ai-translator-ocr-worker.exe
        # runtime/models/...
        return Path(sys.executable).resolve().parent.parent / "models"

    return None


def production_model_dirs() -> tuple[Path, Path] | None:
    root = production_model_root()
    if root is None:
        return None

    detection = root / "PP-OCRv6_medium_det"
    recognition = root / "PP-OCRv6_medium_rec"

    if detection.is_dir() and recognition.is_dir():
        return detection, recognition

    if getattr(sys, "frozen", False) or os.environ.get(
        "AI_TRANSLATOR_OCR_MODEL_ROOT", ""
    ).strip():
        raise FileNotFoundError(
            "Thiếu OCR production model bundle: "
            f"{detection.name}, {recognition.name}."
        )

    return None


def create_ocr() -> Any:
    # Import here so startup failures can be returned to Electron
    # with a structured fatal message instead of silently exiting.
    from paddleocr import PaddleOCR

    global MODEL_SOURCE
    model_dirs = production_model_dirs()

    common_options = {
        "use_doc_orientation_classify": False,
        "use_doc_unwarping": False,
        "use_textline_orientation": False,
    }

    if model_dirs is not None:
        detection, recognition = model_dirs
        MODEL_SOURCE = "bundled"
        return PaddleOCR(
            text_detection_model_dir=str(detection),
            text_recognition_model_dir=str(recognition),
            **common_options,
        )

    MODEL_SOURCE = "development-cache"
    return PaddleOCR(
        lang="japan",
        **common_options,
    )


def recognize(
    ocr: Any,
    image_path: str
) -> dict[str, Any]:
    path = Path(image_path).resolve()

    if not path.is_file():
        raise FileNotFoundError(
            f"Không tìm thấy ảnh OCR: {path.name}"
        )

    results = ocr.predict(input=str(path))

    texts: list[str] = []
    scores: list[float] = []
    boxes: list[dict[str, float]] = []

    for result in results:
        data = result_to_dict(result)
        payload = data.get("res", data)

        result_texts = payload.get("rec_texts") or []
        result_scores = payload.get("rec_scores") or []
        result_shapes = first_available(
            payload,
            ["rec_polys", "dt_polys", "rec_boxes"]
        )

        for index, raw_text in enumerate(result_texts):
            text = str(raw_text).strip()

            if not text:
                continue

            texts.append(text)

            try:
                score = float(result_scores[index])
            except (IndexError, TypeError, ValueError):
                score = 0.0

            scores.append(score)
            box = None

            try:
                shape = result_shapes[index]

                if (
                    len(shape) == 4
                    and isinstance(shape[0], Number)
                ):
                    x1 = float(shape[0])
                    y1 = float(shape[1])
                    x2 = float(shape[2])
                    y2 = float(shape[3])

                    box = {
                        "x": min(x1, x2),
                        "y": min(y1, y2),
                        "width": max(1.0, abs(x2 - x1)),
                        "height": max(1.0, abs(y2 - y1))
                    }
                else:
                    box = polygon_to_box(shape)
            except Exception:
                box = None

            if box is None:
                box = {
                    "x": 0.0,
                    "y": float(len(boxes) * 40),
                    "width": 300.0,
                    "height": 36.0
                }

            boxes.append(box)

    return {
        "success": True,
        "text": "\n".join(texts),
        "lines": texts,
        "scores": scores,
        "boxes": boxes
    }


def run_diagnostics() -> None:
    emit({
        "type": "diagnostics",
        **runtime_metadata(),
        "dependencyCheck": paddlex_dependency_report("ocr-core"),
    })


def run_worker() -> None:
    startup_started = time.perf_counter()

    try:
        ocr = create_ocr()
    except Exception as error:
        traceback.print_exc(file=sys.stderr)
        emit({
            "type": "fatal",
            "protocol": PROTOCOL_VERSION,
            "error": f"Không thể khởi tạo PaddleOCR: {error}"
        })
        raise SystemExit(2) from error

    startup_ms = round(
        (time.perf_counter() - startup_started) * 1000
    )

    emit({
        "type": "ready",
        **runtime_metadata(startup_ms)
    })

    for raw_line in sys.stdin:
        raw_line = raw_line.strip()

        if not raw_line:
            continue

        request: dict[str, Any] = {}
        request_started = time.perf_counter()

        try:
            request = json.loads(raw_line)

            request_id = str(request.get("id", ""))
            action = str(request.get("action", "ocr"))

            if action == "shutdown":
                emit({
                    "type": "shutdown",
                    "protocol": PROTOCOL_VERSION
                })
                break

            if action == "ping":
                emit({
                    "type": "result",
                    "id": request_id,
                    "success": True,
                    "result": {
                        "pong": True,
                        **runtime_metadata()
                    }
                })
                continue

            if action != "ocr":
                raise ValueError(
                    f"OCR action không hỗ trợ: {action}"
                )

            image_path = request.get("imagePath")

            if not image_path:
                raise ValueError("Thiếu imagePath.")

            result = recognize(
                ocr,
                str(image_path)
            )

            result["durationMs"] = round(
                (time.perf_counter() - request_started) * 1000
            )

            emit({
                "type": "result",
                "id": request_id,
                "success": True,
                "result": result
            })

        except Exception as error:
            traceback.print_exc(file=sys.stderr)

            emit({
                "type": "result",
                "id": str(request.get("id", "")),
                "success": False,
                "error": str(error),
                "durationMs": round(
                    (time.perf_counter() - request_started) * 1000
                )
            })


if __name__ == "__main__":
    if "--diagnostics" in sys.argv:
        run_diagnostics()
    else:
        run_worker()
