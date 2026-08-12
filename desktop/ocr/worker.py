import json
import sys
import traceback
from numbers import Number
from pathlib import Path
from typing import Any

from paddleocr import PaddleOCR


# ======================================================
# UTF-8 TRÊN WINDOWS
# ======================================================

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(
        encoding="utf-8"
    )

if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(
        encoding="utf-8"
    )


OUTPUT_MARKER = "__OCR_JSON__"


def emit(data: dict[str, Any]) -> None:
    """
    Dùng marker để Node.js phân biệt JSON của worker
    với các log khác do PaddleOCR in ra.
    """

    output = json.dumps(
        data,
        ensure_ascii=False,
        separators=(",", ":")
    )

    print(
        OUTPUT_MARKER + output,
        flush=True
    )


def result_to_dict(
    result: Any
) -> dict[str, Any]:
    data = getattr(
        result,
        "json",
        None
    )

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


def polygon_to_box(
    polygon: Any
) -> dict[str, float]:
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

    xs = [
        point["x"]
        for point in points
    ]

    ys = [
        point["y"]
        for point in points
    ]

    left = min(xs)
    top = min(ys)
    right = max(xs)
    bottom = max(ys)

    return {
        "x": left,
        "y": top,
        "width": max(
            1.0,
            right - left
        ),
        "height": max(
            1.0,
            bottom - top
        )
    }


# ======================================================
# TẢI MODEL MỘT LẦN
# ======================================================

ocr = PaddleOCR(
    lang="japan",

    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False
)


def recognize(
    image_path: str
) -> dict[str, Any]:
    path = Path(
        image_path
    ).resolve()

    if not path.is_file():
        raise FileNotFoundError(
            f"Không tìm thấy ảnh: {path}"
        )

    results = ocr.predict(
        input=str(path)
    )

    texts: list[str] = []
    scores: list[float] = []
    boxes: list[dict[str, float]] = []

    for result in results:
        data = result_to_dict(
            result
        )

        payload = data.get(
            "res",
            data
        )

        result_texts = (
            payload.get("rec_texts")
            or []
        )

        result_scores = (
            payload.get("rec_scores")
            or []
        )

        result_shapes = first_available(
            payload,
            [
                "rec_polys",
                "dt_polys",
                "rec_boxes"
            ]
        )

        for index, raw_text in enumerate(
            result_texts
        ):
            text = str(
                raw_text
            ).strip()

            if not text:
                continue

            texts.append(text)

            try:
                score = float(
                    result_scores[index]
                )
            except (
                IndexError,
                TypeError,
                ValueError
            ):
                score = 0.0

            scores.append(score)

            box = None

            try:
                shape = result_shapes[index]
                if (
                    len(shape) == 4
                    and isinstance(
                        shape[0],
                        Number
                    )
                ):
                    x1 = float(shape[0])
                    y1 = float(shape[1])
                    x2 = float(shape[2])
                    y2 = float(shape[3])

                    box = {
                        "x": min(x1, x2),
                        "y": min(y1, y2),

                        "width": max(
                            1.0,
                            abs(x2 - x1)
                        ),

                        "height": max(
                            1.0,
                            abs(y2 - y1)
                        )
                    }
                else:
                    box = polygon_to_box(
                        shape
                    )

            except Exception:
                box = None

            if box is None:
                box = {
                    "x": 0.0,
                    "y": float(
                        len(boxes) * 40
                    ),
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


# ======================================================
# WORKER LOOP
# ======================================================

def run_worker() -> None:
    emit({
        "type": "ready"
    })

    for raw_line in sys.stdin:
        raw_line = raw_line.strip()

        if not raw_line:
            continue

        request: dict[str, Any] = {}

        try:
            request = json.loads(
                raw_line
            )

            request_id = str(
                request.get("id", "")
            )

            action = request.get(
                "action",
                "ocr"
            )

            if action == "shutdown":
                emit({
                    "type": "shutdown"
                })

                break

            image_path = request.get(
                "imagePath"
            )

            if not image_path:
                raise ValueError(
                    "Thiếu imagePath."
                )

            result = recognize(
                image_path
            )

            emit({
                "type": "result",
                "id": request_id,
                "success": True,
                "result": result
            })

        except Exception as error:
            traceback.print_exc(
                file=sys.stderr
            )

            emit({
                "type": "result",
                "id": str(
                    request.get("id", "")
                ),
                "success": False,
                "error": str(error)
            })


if __name__ == "__main__":
    run_worker()