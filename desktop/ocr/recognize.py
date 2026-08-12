import json
import sys
import traceback
from pathlib import Path
from typing import Any

from paddleocr import PaddleOCR


# ======================================================
# UTF-8 OUTPUT FOR WINDOWS
# ======================================================

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(
        encoding="utf-8"
    )

if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(
        encoding="utf-8"
    )


# ======================================================
# JSON OUTPUT
# ======================================================

def send_result(data: dict[str, Any]) -> None:
    print(
        json.dumps(
            data,
            ensure_ascii=False
        ),
        flush=True
    )


# ======================================================
# RESULT CONVERSION
# ======================================================

def result_to_dict(
    result: Any
) -> dict[str, Any]:
    """
    Chuyển kết quả PaddleOCR thành dict thông thường.

    PaddleOCR có thể trả result.json dưới dạng:
    - dict
    - string JSON
    - callable
    """

    data = getattr(
        result,
        "json",
        None
    )

    if callable(data):
        data = data()

    if isinstance(data, str):
        data = json.loads(data)

    if isinstance(data, dict):
        return data

    # Phương án dự phòng nếu object hỗ trợ save_to_json.
    if hasattr(
        result,
        "save_to_json"
    ):
        raise TypeError(
            "Kết quả OCR không đọc được trực tiếp. "
            "Hãy kiểm tra phiên bản PaddleOCR."
        )

    raise TypeError(
        f"Không hỗ trợ kiểu kết quả OCR: "
        f"{type(result).__name__}"
    )


# ======================================================
# POLYGON TO RECTANGLE
# ======================================================

def polygon_to_box(
    polygon: Any
) -> dict[str, float]:
    """
    Chuyển polygon gồm nhiều điểm thành bounding rectangle:
    x, y, width, height.
    """

    if polygon is None:
        raise ValueError(
            "Polygon không tồn tại."
        )

    points: list[dict[str, float]] = []

    for point in polygon:
        if (
            point is None
            or len(point) < 2
        ):
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
# OCR PROCESSING
# ======================================================

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

    ocr = PaddleOCR(
        lang="japan",

        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False
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

        result_texts = payload.get(
            "rec_texts",
            []
        ) or []

        result_scores = payload.get(
            "rec_scores",
            []
        ) or []

        result_polygons = (
            payload.get("rec_polys")
            or payload.get("dt_polys")
            or payload.get("rec_boxes")
            or []
        )

        for index, raw_text in enumerate(
            result_texts
        ):
            clean_text = str(
                raw_text
            ).strip()

            if not clean_text:
                continue

            texts.append(
                clean_text
            )

            if index < len(
                result_scores
            ):
                try:
                    score = float(
                        result_scores[index]
                    )
                except (
                    TypeError,
                    ValueError
                ):
                    score = 0.0
            else:
                score = 0.0

            scores.append(
                score
            )

            box = None

            if index < len(
                result_polygons
            ):
                polygon = (
                    result_polygons[index]
                )

                try:
                    # rec_boxes đôi khi đã là:
                    # [x1, y1, x2, y2]
                    if (
                        len(polygon) == 4
                        and not isinstance(
                            polygon[0],
                            (
                                list,
                                tuple
                            )
                        )
                    ):
                        x1 = float(
                            polygon[0]
                        )

                        y1 = float(
                            polygon[1]
                        )

                        x2 = float(
                            polygon[2]
                        )

                        y2 = float(
                            polygon[3]
                        )

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
                            polygon
                        )

                except Exception:
                    box = None

            if box is None:
                """
                Fallback để số lượng boxes luôn khớp
                với số lượng lines.
                """

                box = {
                    "x": 0.0,
                    "y": float(
                        index * 40
                    ),
                    "width": 300.0,
                    "height": 36.0
                }

            boxes.append(
                box
            )

    return {
        "success": True,
        "text": "\n".join(texts),
        "lines": texts,
        "scores": scores,
        "boxes": boxes
    }


# ======================================================
# MAIN
# ======================================================

def main() -> None:
    try:
        if len(sys.argv) < 2:
            raise ValueError(
                "Thiếu đường dẫn ảnh."
            )

        output = recognize(
            sys.argv[1]
        )

        send_result(
            output
        )

    except Exception as error:
        traceback.print_exc(
            file=sys.stderr
        )

        send_result({
            "success": False,
            "text": "",
            "lines": [],
            "scores": [],
            "boxes": [],
            "error": str(error)
        })

        sys.exit(1)


if __name__ == "__main__":
    main()