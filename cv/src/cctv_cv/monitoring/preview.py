import asyncio
import time
from dataclasses import dataclass


@dataclass
class _Preview:
    jpeg: bytes | None = None
    sequence: int = 0
    viewers: int = 0
    touched_at: float = 0


class PreviewHub:
    def __init__(self) -> None:
        self.previews: dict[str, _Preview] = {}
        self.condition = asyncio.Condition()

    def demanded(self, camera_id: str, idle_timeout: int) -> bool:
        preview = self.previews.get(camera_id)
        if not preview:
            return False
        return preview.viewers > 0 or time.monotonic() - preview.touched_at < idle_timeout

    async def touch(self, camera_id: str) -> None:
        async with self.condition:
            preview = self.previews.setdefault(camera_id, _Preview())
            preview.touched_at = time.monotonic()

    async def publish(self, camera_id: str, jpeg: bytes) -> None:
        async with self.condition:
            preview = self.previews.setdefault(camera_id, _Preview())
            preview.jpeg = jpeg
            preview.sequence += 1
            self.condition.notify_all()

    async def stream(self, camera_id: str):  # type: ignore[no-untyped-def]
        async with self.condition:
            preview = self.previews.setdefault(camera_id, _Preview())
            preview.viewers += 1
            preview.touched_at = time.monotonic()
        sequence = -1
        try:
            while True:
                async with self.condition:
                    expected = sequence

                    def frame_changed(expected_sequence: int = expected) -> bool:
                        return self.previews[camera_id].sequence != expected_sequence

                    await self.condition.wait_for(frame_changed)
                    preview = self.previews[camera_id]
                    sequence = preview.sequence
                    jpeg = preview.jpeg
                if jpeg:
                    yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n"
        finally:
            async with self.condition:
                self.previews[camera_id].viewers = max(0, self.previews[camera_id].viewers - 1)
