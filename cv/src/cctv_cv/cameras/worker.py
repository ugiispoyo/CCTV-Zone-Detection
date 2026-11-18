import asyncio
import time
from datetime import UTC, datetime
from uuid import uuid4

import cv2
import numpy as np
import structlog

from cctv_cv.config import Settings
from cctv_cv.detection import Detector, FaceDetector
from cctv_cv.domain.models import Box, CameraConfig, Detection, DetectionEvent, ObjectType
from cctv_cv.domain.schedule import zone_is_active
from cctv_cv.integrations import PlatformApi, RabbitMessaging
from cctv_cv.media import MediaManager
from cctv_cv.monitoring.metrics import (
    CAMERA_CONNECTED,
    CAMERA_FRAMES,
    DETECTIONS,
    EVENTS,
    INFERENCE_SECONDS,
)
from cctv_cv.monitoring.preview import PreviewHub
from cctv_cv.tracking import IoUTracker
from cctv_cv.zones import ZoneEvaluator

from .capture import RtspCapture

log = structlog.get_logger()


class CameraWorker:
    def __init__(
        self,
        camera: CameraConfig,
        settings: Settings,
        detector: Detector,
        face_detector: FaceDetector,
        platform: PlatformApi,
        messaging: RabbitMessaging,
        previews: PreviewHub,
        media: MediaManager,
    ) -> None:
        self.camera = camera
        self.settings = settings
        self.detector = detector
        self.face_detector = face_detector
        self.platform = platform
        self.messaging = messaging
        self.previews = previews
        self.media = media
        self.capture = RtspCapture(camera.rtspUrl)
        self.tracker = IoUTracker()
        self.zones = ZoneEvaluator(camera, settings.event_cooldown_seconds)
        self.stopping = False
        self.draining = False
        self.last_detections: list[Detection] = []
        self.last_inference = 0.0
        self.last_heartbeat = 0.0
        self.status = "connecting"

    async def run(self) -> None:
        await self._status("connecting")
        backoff = 1.0
        while not self.stopping:
            loop_started = time.monotonic()
            detection_active = not self.draining and self._detection_active()
            preview_active = self.previews.demanded(
                self.camera.id, self.camera.preview.idleTimeoutSeconds
            )
            recording_active = bool(self.media.active)
            if not detection_active and not preview_active and not recording_active:
                self.capture.close()
                CAMERA_CONNECTED.labels(self.camera.id).set(0)
                await self._status("scheduled-off")
                await asyncio.sleep(1)
                continue
            if self.capture.capture is None and not await asyncio.to_thread(self.capture.open):
                await self._status("reconnecting", "RTSP connection failed")
                await asyncio.sleep(backoff)
                backoff = min(30, backoff * 2)
                continue
            backoff = 1
            success, frame = await asyncio.to_thread(self.capture.read)
            if not success or frame is None:
                self.capture.close()
                CAMERA_CONNECTED.labels(self.camera.id).set(0)
                await self._status("reconnecting", "RTSP read failed")
                continue
            CAMERA_CONNECTED.labels(self.camera.id).set(1)
            CAMERA_FRAMES.labels(self.camera.id).inc()
            await self._status("online")
            try:
                await self._process(frame, detection_active, preview_active)
            except Exception as error:
                log.exception("frame_processing_failed", camera_id=self.camera.id)
                await self._status("error", type(error).__name__)
            elapsed = time.monotonic() - loop_started
            await asyncio.sleep(max(0, 1 / self.settings.capture_fps - elapsed))
        self.capture.close()
        self.media.close()

    async def stop(self) -> None:
        self.draining = True
        if self.media.active:
            try:
                await asyncio.wait_for(
                    self.media.idle.wait(), timeout=self.settings.clip_seconds + 2
                )
            except TimeoutError:
                log.error("media_drain_timeout", camera_id=self.camera.id)
        self.stopping = True

    async def _process(
        self, frame: np.ndarray, detection_active: bool, preview_active: bool
    ) -> None:
        await asyncio.to_thread(self.media.add_frame, frame)
        target_fps = (
            self.settings.detection_fps if detection_active else self.camera.preview.inferenceFps
        )
        now = time.monotonic()
        if now - self.last_inference >= 1 / target_fps:
            with INFERENCE_SECONDS.labels(self.camera.id).time():
                detections = await asyncio.to_thread(self.detector.detect, frame)
            self.last_detections = self.tracker.update(detections)
            self.last_inference = now
            for detection in self.last_detections:
                DETECTIONS.labels(self.camera.id, detection.object_type.value).inc()
            if detection_active:
                await self._handle_triggers(frame)
        if preview_active:
            annotated = _annotate(frame, self.last_detections)
            success, encoded = cv2.imencode(
                ".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, self.settings.jpeg_quality]
            )
            if success:
                await self.previews.publish(self.camera.id, encoded.tobytes())

    async def _handle_triggers(self, frame: np.ndarray) -> None:
        for trigger in self.zones.update(self.last_detections):
            matching_head = _head_for(trigger.object_box, self.last_detections)
            face_box = None
            if trigger.object_type == ObjectType.PERSON:
                face_box = await asyncio.to_thread(
                    self.face_detector.largest_face, frame, trigger.object_box
                )
            head_box = (
                trigger.object_box if trigger.object_type == ObjectType.HEAD else matching_head
            )
            event = DetectionEvent(
                eventId=str(uuid4()),
                cameraId=self.camera.id,
                zoneId=trigger.zone_id,
                trackId=f"{self.camera.id}:{trigger.object_type.value}:{trigger.track_id}",
                objectType=trigger.object_type,
                occurredAt=trigger.occurred_at,
                confidence=trigger.confidence,
                objectBox=trigger.object_box,
                headBox=head_box,
                faceBox=face_box,
                trigger=trigger.trigger,
                direction=trigger.direction,
            )
            try:
                await self.messaging.publish_detection(event)
            except Exception:
                log.exception("rabbit_publish_failed_using_http", event_id=event.eventId)
                await self.platform.detection_fallback(event)
            try:
                self.media.idle.clear()
                await asyncio.to_thread(
                    self.media.start, event, frame.copy(), trigger.object_box, face_box, head_box
                )
            except Exception:
                if not self.media.active:
                    self.media.idle.set()
                log.exception("media_capture_start_failed", event_id=event.eventId)
                continue
            EVENTS.labels(self.camera.id, trigger.object_type.value, trigger.trigger).inc()

    def _detection_active(self) -> bool:
        now = datetime.now(UTC)
        return any(
            zone.enabled
            and zone_is_active(
                self.camera.schedule,
                zone.schedule,
                zone.scheduleMode,
                self.camera.timezone,
                now,
            )
            for zone in self.camera.zones
        )

    async def _status(self, status: str, error: str | None = None) -> None:
        now = time.monotonic()
        if status == self.status and now - self.last_heartbeat < self.settings.heartbeat_seconds:
            return
        self.status = status
        self.last_heartbeat = now
        try:
            await self.platform.heartbeat(self.camera.id, status, error)
        except Exception:
            log.exception("heartbeat_failed", camera_id=self.camera.id, status=status)


def _head_for(person_box: Box, detections: list[Detection]) -> Box | None:
    candidates = [
        item
        for item in detections
        if item.object_type == ObjectType.HEAD
        and person_box.x <= item.box.x + item.box.width / 2 <= person_box.x + person_box.width
        and person_box.y <= item.box.y + item.box.height / 2 <= person_box.y + person_box.height
    ]
    return max(candidates, key=lambda item: item.confidence).box if candidates else None


def _annotate(frame: np.ndarray, detections: list[Detection]) -> np.ndarray:
    output = frame.copy()
    height, width = output.shape[:2]
    colors = {
        ObjectType.PERSON: (80, 210, 130),
        ObjectType.CAR: (245, 170, 65),
        ObjectType.MOTORCYCLE: (180, 110, 245),
        ObjectType.HEAD: (80, 190, 245),
    }
    for item in detections:
        x1, y1 = int(item.box.x * width), int(item.box.y * height)
        x2 = int((item.box.x + item.box.width) * width)
        y2 = int((item.box.y + item.box.height) * height)
        color = colors[item.object_type]
        cv2.rectangle(output, (x1, y1), (x2, y2), color, 2)
        label = f"{item.object_type.value} #{item.track_id} {item.confidence:.2f}"
        cv2.putText(output, label, (x1, max(20, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)
    return output
