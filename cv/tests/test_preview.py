import cv2
import numpy as np

from cctv_cv.cameras.worker import _encode_preview


def test_medium_preview_is_resized_and_encoded() -> None:
    frame = np.zeros((1080, 1920, 3), dtype=np.uint8)

    encoded = _encode_preview(frame, [], False, "medium")

    assert encoded is not None
    decoded = cv2.imdecode(np.frombuffer(encoded, dtype=np.uint8), cv2.IMREAD_COLOR)
    assert decoded.shape[:2] == (540, 960)
