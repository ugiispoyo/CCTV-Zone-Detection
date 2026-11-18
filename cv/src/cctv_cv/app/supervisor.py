import asyncio
from pathlib import Path

import structlog

from cctv_cv.cameras import CameraWorker
from cctv_cv.config import Settings
from cctv_cv.detection import FaceDetector, UltralyticsDetector
from cctv_cv.domain.models import CameraConfig
from cctv_cv.integrations import PlatformApi, RabbitMessaging
from cctv_cv.media import MediaBundle, MediaManager
from cctv_cv.monitoring.metrics import MEDIA_UPLOADS, SPOOL_BYTES
from cctv_cv.monitoring.preview import PreviewHub

log = structlog.get_logger()


class CameraSupervisor:
    def __init__(
        self,
        settings: Settings,
        platform: PlatformApi,
        messaging: RabbitMessaging,
        previews: PreviewHub,
    ) -> None:
        self.settings = settings
        self.platform = platform
        self.messaging = messaging
        self.previews = previews
        self.detector = UltralyticsDetector(settings)
        self.face_detector = FaceDetector(settings.face_model_path, settings.face_confidence)
        self.completed: asyncio.Queue[MediaBundle] = asyncio.Queue()
        self.workers: dict[str, CameraWorker] = {}
        self.tasks: dict[str, asyncio.Task[None]] = {}
        self.media_managers: dict[str, MediaManager] = {}
        self.loaded = False
        self.refresh_lock = asyncio.Lock()
        self.stopping = False

    async def run(self) -> None:
        await self.refresh()
        uploader = asyncio.create_task(self._upload_loop(), name="media-uploader")
        poller = asyncio.create_task(self._poll_loop(), name="configuration-poller")
        try:
            await asyncio.gather(uploader, poller)
        finally:
            uploader.cancel()
            poller.cancel()

    async def refresh(self) -> None:
        async with self.refresh_lock:
            cameras = {
                camera.id: camera
                for camera in await self.platform.configuration()
                if camera.enabled
            }
            for camera_id in set(self.workers) - set(cameras):
                await self._remove(camera_id)
            for camera_id, camera in cameras.items():
                existing = self.workers.get(camera_id)
                task = self.tasks.get(camera_id)
                if (
                    existing
                    and task
                    and not task.done()
                    and existing.camera.model_dump() == camera.model_dump()
                ):
                    continue
                if existing:
                    await self._remove(camera_id)
                self._add(camera)
            self.loaded = True
            log.info("configuration_applied", active_cameras=len(cameras))

    async def stop(self) -> None:
        self.stopping = True
        await asyncio.gather(*(self._remove(camera_id) for camera_id in list(self.workers)))

    def _add(self, camera: CameraConfig) -> None:
        media = MediaManager(self.settings, self.completed)
        worker = CameraWorker(
            camera,
            self.settings,
            self.detector,
            self.face_detector,
            self.platform,
            self.messaging,
            self.previews,
            media,
        )
        self.media_managers[camera.id] = media
        self.workers[camera.id] = worker
        self.tasks[camera.id] = asyncio.create_task(worker.run(), name=f"camera-{camera.id}")

    async def _remove(self, camera_id: str) -> None:
        worker = self.workers.pop(camera_id, None)
        task = self.tasks.pop(camera_id, None)
        self.media_managers.pop(camera_id, None)
        if worker:
            await worker.stop()
        if task:
            try:
                await asyncio.wait_for(task, timeout=10)
            except TimeoutError:
                task.cancel()
            except asyncio.CancelledError:
                pass

    async def _poll_loop(self) -> None:
        while not self.stopping:
            await asyncio.sleep(self.settings.config_refresh_seconds)
            try:
                await self.refresh()
            except Exception:
                log.exception("configuration_refresh_failed")

    async def _upload_loop(self) -> None:
        await self._enqueue_existing_spool()
        while not self.stopping:
            bundle = await self.completed.get()
            try:
                await self.platform.upload_media(bundle.event_id, bundle.files)
                MediaManager.remove(bundle)
                MEDIA_UPLOADS.labels("success").inc()
            except Exception:
                MEDIA_UPLOADS.labels("failed").inc()
                log.exception("media_upload_failed", event_id=bundle.event_id)
                await asyncio.sleep(30)
                await self.completed.put(bundle)
            finally:
                self.completed.task_done()
                SPOOL_BYTES.set(_directory_size(self.settings.spool_dir))

    async def _enqueue_existing_spool(self) -> None:
        for directory in self.settings.spool_dir.iterdir():
            if not directory.is_dir():
                continue
            files = {
                "body": directory / "object.jpg",
                "frame": directory / "frame.jpg",
                "clip": directory / "clip.mp4",
            }
            face = next(iter(directory.glob("face.jpg")), None) or next(
                iter(directory.glob("head.jpg")), None
            )
            if face:
                files["face"] = face
            if (directory / ".complete").exists() and all(
                path.exists() and path.stat().st_size > 0 for path in files.values()
            ):
                await self.completed.put(MediaBundle(directory.name, directory, files))


def _directory_size(path: Path) -> int:
    return sum(item.stat().st_size for item in path.rglob("*") if item.is_file())
