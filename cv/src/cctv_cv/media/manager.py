import asyncio
import shutil
import time
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from cctv_cv.config import Settings
from cctv_cv.domain.models import Box, DetectionEvent

from .clip_writer import ClipWriter


@dataclass
class MediaBundle:
    event_id: str
    directory: Path
    files: dict[str, Path]


@dataclass
class _Capture:
    event_id: str
    deadline: float
    directory: Path
    writer: ClipWriter
    files: dict[str, Path]


class MediaManager:
    def __init__(self, settings: Settings, completed: asyncio.Queue[MediaBundle]) -> None:
        self.settings = settings
        self.completed = completed
        self.loop = asyncio.get_running_loop()
        self.idle = asyncio.Event()
        self.idle.set()
        self.active: dict[str, _Capture] = {}
        settings.spool_dir.mkdir(parents=True, exist_ok=True)

    def start(
        self,
        event: DetectionEvent,
        frame: np.ndarray,
        object_box: Box,
        face_box: Box | None,
        head_box: Box | None,
    ) -> None:
        if self.disk_usage_bytes() >= self.settings.spool_max_gb * 1024**3:
            raise RuntimeError("media spool capacity limit reached")
        directory = self.settings.spool_dir / event.eventId
        directory.mkdir(parents=True, exist_ok=False)
        files = {
            "body": directory / "object.jpg",
            "frame": directory / "frame.jpg",
            "clip": directory / "clip.mp4",
        }
        self._save_jpeg(files["frame"], frame)
        self._save_jpeg(files["body"], _crop(frame, object_box))
        crop_box = face_box or head_box
        if crop_box:
            files["face"] = directory / ("face.jpg" if face_box else "head.jpg")
            self._save_jpeg(files["face"], _crop(frame, crop_box))
        writer = ClipWriter(files["clip"], self.settings.clip_fps, self.settings.clip_width)
        writer.write(frame)
        self.active[event.eventId] = _Capture(
            event_id=event.eventId,
            deadline=time.monotonic() + self.settings.clip_seconds,
            directory=directory,
            writer=writer,
            files=files,
        )

    def add_frame(self, frame: np.ndarray) -> None:
        now = time.monotonic()
        for event_id, capture in list(self.active.items()):
            if now < capture.deadline:
                capture.writer.write(frame)
                continue
            capture.writer.close()
            (capture.directory / ".complete").touch()
            bundle = MediaBundle(capture.event_id, capture.directory, capture.files)
            self.loop.call_soon_threadsafe(self.completed.put_nowait, bundle)
            del self.active[event_id]
            if not self.active:
                self.loop.call_soon_threadsafe(self.idle.set)

    def close(self) -> None:
        for capture in self.active.values():
            capture.writer.close()
        self.active.clear()
        self.idle.set()

    def disk_usage_bytes(self) -> int:
        return sum(
            path.stat().st_size for path in self.settings.spool_dir.rglob("*") if path.is_file()
        )

    @staticmethod
    def remove(bundle: MediaBundle) -> None:
        shutil.rmtree(bundle.directory)

    def _save_jpeg(self, path: Path, frame: np.ndarray) -> None:
        success = cv2.imwrite(
            str(path), frame, [cv2.IMWRITE_JPEG_QUALITY, self.settings.jpeg_quality]
        )
        if not success:
            raise RuntimeError(f"failed to write {path.name}")


def _crop(frame: np.ndarray, box: Box) -> np.ndarray:
    height, width = frame.shape[:2]
    x1 = max(0, int(box.x * width))
    y1 = max(0, int(box.y * height))
    x2 = min(width, int((box.x + box.width) * width))
    y2 = min(height, int((box.y + box.height) * height))
    return frame[y1:y2, x1:x2]
