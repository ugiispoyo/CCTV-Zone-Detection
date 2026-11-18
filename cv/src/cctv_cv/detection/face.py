from pathlib import Path

import cv2
import numpy as np
import structlog

from cctv_cv.domain.models import Box

log = structlog.get_logger()


class FaceDetector:
    def __init__(self, model_path: Path, confidence: float) -> None:
        self.enabled = model_path.exists()
        self.confidence = confidence
        self.detector = None
        if self.enabled:
            self.detector = cv2.FaceDetectorYN.create(
                str(model_path), "", (320, 320), confidence, 0.3, 5000
            )
        else:
            log.warning("face_detector_disabled", path=str(model_path))

    def largest_face(self, frame: np.ndarray, person: Box) -> Box | None:
        if self.detector is None:
            return None
        height, width = frame.shape[:2]
        x1, y1, x2, y2 = _pixels(person, width, height)
        crop = frame[y1:y2, x1:x2]
        if crop.size == 0:
            return None
        self.detector.setInputSize((crop.shape[1], crop.shape[0]))
        _, faces = self.detector.detect(crop)
        if faces is None:
            return None
        face = max(faces, key=lambda item: float(item[2] * item[3]))
        fx, fy, fw, fh = (float(value) for value in face[:4])
        return Box(
            x=(x1 + fx) / width,
            y=(y1 + fy) / height,
            width=min(fw / width, 1),
            height=min(fh / height, 1),
        )


def _pixels(box: Box, width: int, height: int) -> tuple[int, int, int, int]:
    return (
        max(0, int(box.x * width)),
        max(0, int(box.y * height)),
        min(width, int((box.x + box.width) * width)),
        min(height, int((box.y + box.height) * height)),
    )
