from pathlib import Path
from threading import Lock

import numpy as np
import structlog
from ultralytics import YOLO  # type: ignore[attr-defined]

from cctv_cv.config import Settings
from cctv_cv.domain.models import Box, Detection, ObjectType

log = structlog.get_logger()

COCO_TO_OBJECT = {
    "person": ObjectType.PERSON,
    "car": ObjectType.CAR,
    "motorcycle": ObjectType.MOTORCYCLE,
}


class UltralyticsDetector:
    """Thread-safe detector. Tracking state intentionally lives outside the model."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.model = YOLO(settings.model_path)
        self.lock = Lock()
        self.target_names = settings.target_class_names & COCO_TO_OBJECT.keys()
        self.class_ids = [
            class_id
            for class_id, name in self.model.names.items()
            if str(name).lower() in self.target_names
        ]
        if not self.class_ids:
            raise ValueError(f"model has none of target classes: {sorted(self.target_names)}")

        self.head_model = None
        if settings.head_model_path and Path(settings.head_model_path).exists():
            self.head_model = YOLO(str(settings.head_model_path))
        elif "head" in settings.target_class_names:
            log.warning("head_detector_disabled", reason="CV_HEAD_MODEL_PATH is missing")

    def detect(self, frame: np.ndarray) -> list[Detection]:
        height, width = frame.shape[:2]
        with self.lock:
            results = list(
                self.model.predict(
                    frame,
                    classes=self.class_ids,
                    conf=self.settings.detection_confidence,
                    iou=self.settings.detection_iou,
                    imgsz=self.settings.model_image_size,
                    device=self.settings.model_device,
                    verbose=False,
                )
            )
            result = results[0]
            detections = self._convert(result, width, height)
            if self.head_model is not None:
                head_results = list(
                    self.head_model.predict(
                        frame,
                        classes=[self.settings.head_model_class_id],
                        conf=self.settings.detection_confidence,
                        iou=self.settings.detection_iou,
                        imgsz=self.settings.model_image_size,
                        device=self.settings.model_device,
                        verbose=False,
                    )
                )
                head_result = head_results[0]
                detections.extend(self._heads(head_result, width, height))
        return detections

    def _convert(self, result: object, width: int, height: int) -> list[Detection]:
        converted: list[Detection] = []
        boxes = getattr(result, "boxes", None)
        if boxes is None:
            return converted
        for xyxy, confidence, class_id in zip(
            boxes.xyxy.cpu().numpy(),
            boxes.conf.cpu().numpy(),
            boxes.cls.cpu().numpy(),
            strict=True,
        ):
            name = str(self.model.names[int(class_id)]).lower()
            object_type = COCO_TO_OBJECT.get(name)
            if object_type:
                converted.append(
                    Detection(
                        object_type=object_type,
                        confidence=float(confidence),
                        box=_normalize_box(xyxy, width, height),
                    )
                )
        return converted

    def _heads(self, result: object, width: int, height: int) -> list[Detection]:
        boxes = getattr(result, "boxes", None)
        if boxes is None:
            return []
        return [
            Detection(
                object_type=ObjectType.HEAD,
                confidence=float(confidence),
                box=_normalize_box(xyxy, width, height),
            )
            for xyxy, confidence in zip(
                boxes.xyxy.cpu().numpy(), boxes.conf.cpu().numpy(), strict=True
            )
        ]


def _normalize_box(xyxy: np.ndarray, width: int, height: int) -> Box:
    x1, y1, x2, y2 = (float(value) for value in xyxy)
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(width, x2), min(height, y2)
    return Box(x=x1 / width, y=y1 / height, width=(x2 - x1) / width, height=(y2 - y1) / height)
