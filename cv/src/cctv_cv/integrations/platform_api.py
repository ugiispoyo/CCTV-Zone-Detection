from pathlib import Path
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential_jitter

from cctv_cv.domain.models import CameraConfig, DetectionEvent


class PlatformApi:
    def __init__(self, base_url: str) -> None:
        self.client = httpx.AsyncClient(base_url=base_url.rstrip("/"), timeout=30)

    async def close(self) -> None:
        await self.client.aclose()

    @retry(
        stop=stop_after_attempt(5), wait=wait_exponential_jitter(initial=1, max=20), reraise=True
    )
    async def configuration(self) -> list[CameraConfig]:
        response = await self.client.get("/internal/v1/cv/configuration")
        response.raise_for_status()
        return [CameraConfig.model_validate(item) for item in response.json()]

    async def heartbeat(self, camera_id: str, status: str, error: str | None = None) -> None:
        payload: dict[str, str] = {"status": status}
        if error:
            payload["error"] = error[:500]
        response = await self.client.post(
            f"/internal/v1/cameras/{camera_id}/heartbeat", json=payload, timeout=10
        )
        response.raise_for_status()

    async def detection_fallback(self, event: DetectionEvent) -> None:
        response = await self.client.post(
            "/internal/v1/detections", json=event.model_dump(mode="json"), timeout=10
        )
        response.raise_for_status()

    @retry(
        stop=stop_after_attempt(8), wait=wait_exponential_jitter(initial=2, max=120), reraise=True
    )
    async def upload_media(self, event_id: str, files: dict[str, Path]) -> None:
        handles = []
        try:
            multipart: dict[str, tuple[str, Any, str]] = {}
            for field, path in files.items():
                handle = path.open("rb")
                handles.append(handle)
                mime = "video/mp4" if field == "clip" else "image/jpeg"
                multipart[field] = (path.name, handle, mime)
            response = await self.client.post(
                f"/internal/v1/detections/{event_id}/media",
                files=multipart,
                timeout=httpx.Timeout(180, connect=10),
            )
            response.raise_for_status()
        finally:
            for handle in handles:
                handle.close()
