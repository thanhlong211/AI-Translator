import json
import sys
from pathlib import Path

import cv2
import numpy as np


def find_nearest_white_pixel(
    mask: np.ndarray,
    center_x: int,
    center_y: int,
    radius: int = 35
) -> tuple[int, int] | None:
    height, width = mask.shape

    for distance in range(radius + 1):
        left = max(0, center_x - distance)
        right = min(width - 1, center_x + distance)

        top = max(0, center_y - distance)
        bottom = min(height - 1, center_y + distance)

        for x in range(left, right + 1):
            if mask[top, x] == 255:
                return x, top

            if mask[bottom, x] == 255:
                return x, bottom

        for y in range(top, bottom + 1):
            if mask[y, left] == 255:
                return left, y

            if mask[y, right] == 255:
                return right, y

    return None


def detect_bubbles(
    image_path: str,
    ocr_boxes: list[dict]
) -> dict:
    path = Path(image_path).resolve()

    if not path.is_file():
        raise FileNotFoundError(
            f"Không tìm thấy ảnh: {path}"
        )

    image = cv2.imread(str(path))

    if image is None:
        raise ValueError(
            "Không đọc được ảnh."
        )

    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY
    )

    image_height, image_width = gray.shape

    # Nhận vùng sáng, bao gồm nền bubble hơi xám.
    _, white_mask = cv2.threshold(
        gray,
        175,
        255,
        cv2.THRESH_BINARY
    )

    # Nối các vùng trắng bị chữ chia nhỏ.
    kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE,
        (11, 11)
    )

    white_mask = cv2.morphologyEx(
        white_mask,
        cv2.MORPH_CLOSE,
        kernel,
        iterations=3
    )

    bubbles = []

    for box in ocr_boxes:
        center_x = int(
            box["x"] +
            box["width"] / 2
        )

        center_y = int(
            box["y"] +
            box["height"] / 2
        )

        seed = find_nearest_white_pixel(
            white_mask,
            center_x,
            center_y
        )

        if seed is None:
            continue

        flood_image = white_mask.copy()

        flood_mask = np.zeros(
            (
                image_height + 2,
                image_width + 2
            ),
            dtype=np.uint8
        )

        cv2.floodFill(
            flood_image,
            flood_mask,
            seed,
            128
        )

        component = np.uint8(
            flood_image == 128
        ) * 255

        contours, _ = cv2.findContours(
            component,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE
        )

        if not contours:
            continue

        contour = max(
            contours,
            key=cv2.contourArea
        )

        x, y, width, height = (
            cv2.boundingRect(contour)
        )

        area = width * height

        if area < 600:
            continue

        if (
            width > image_width * 0.95
            and
            height > image_height * 0.95
        ):
            continue

        padding = 6

        x = max(0, x - padding)
        y = max(0, y - padding)

        width = min(
            image_width - x,
            width + padding * 2
        )

        height = min(
            image_height - y,
            height + padding * 2
        )

        candidate = {
            "x": int(x),
            "y": int(y),
            "width": int(width),
            "height": int(height)
        }

        # Không thêm bubble trùng.
        duplicate = any(
            abs(item["x"] - candidate["x"]) < 10
            and
            abs(item["y"] - candidate["y"]) < 10
            and
            abs(item["width"] - candidate["width"]) < 15
            and
            abs(item["height"] - candidate["height"]) < 15
            for item in bubbles
        )

        if not duplicate:
            bubbles.append(candidate)

    return {
        "success": True,
        "imageWidth": image_width,
        "imageHeight": image_height,
        "bubbles": bubbles
    }


def main() -> None:
    try:
        if len(sys.argv) < 3:
            raise ValueError(
                "Cần truyền đường dẫn ảnh và OCR boxes."
            )

        image_path = sys.argv[1]

        ocr_boxes = json.loads(
            sys.argv[2]
        )

        result = detect_bubbles(
            image_path,
            ocr_boxes
        )

        print(
            json.dumps(
                result,
                ensure_ascii=False
            ),
            flush=True
        )

    except Exception as error:
        print(
            json.dumps(
                {
                    "success": False,
                    "error": str(error),
                    "bubbles": []
                },
                ensure_ascii=False
            ),
            flush=True
        )

        sys.exit(1)


if __name__ == "__main__":
    main()