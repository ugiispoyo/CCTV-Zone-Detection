import subprocess
from pathlib import Path

import cv2
import imageio_ffmpeg  # type: ignore[import-untyped]
import numpy as np


class ClipWriter:
    def __init__(self, path: Path, fps: float, target_width: int) -> None:
        self.path = path
        self.fps = max(1, round(fps))
        self.target_width = target_width
        self.process: subprocess.Popen[bytes] | None = None

    def write(self, frame: np.ndarray) -> None:
        resized = self._resize(frame)
        if self.process is None:
            self.process = self._start(resized.shape[1], resized.shape[0])
        if self.process.stdin is None:
            raise RuntimeError("FFmpeg stdin is unavailable")
        self.process.stdin.write(resized.tobytes())

    def close(self) -> None:
        if self.process is None:
            return
        if self.process.stdin:
            self.process.stdin.close()
        return_code = self.process.wait(timeout=60)
        error = self.process.stderr.read().decode(errors="replace") if self.process.stderr else ""
        self.process = None
        if return_code != 0:
            raise RuntimeError(f"FFmpeg exited with {return_code}: {error[-1000:]}")

    def abort(self) -> None:
        if self.process is None:
            return
        process = self.process
        self.process = None
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=1)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=1)
        if process.stdin:
            try:
                process.stdin.close()
            except OSError:
                pass

    def _start(self, width: int, height: int) -> subprocess.Popen[bytes]:
        command = [
            imageio_ffmpeg.get_ffmpeg_exe(),
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "bgr24",
            "-s",
            f"{width}x{height}",
            "-r",
            str(self.fps),
            "-i",
            "pipe:0",
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(self.path),
        ]
        return subprocess.Popen(command, stdin=subprocess.PIPE, stderr=subprocess.PIPE)

    def _resize(self, frame: np.ndarray) -> np.ndarray:
        height, width = frame.shape[:2]
        if width <= self.target_width:
            resized = frame
        else:
            target_height = round(height * self.target_width / width)
            resized = cv2.resize(frame, (self.target_width, target_height))
        final_height, final_width = resized.shape[:2]
        if final_width % 2 or final_height % 2:
            resized = cv2.resize(
                resized, (final_width - final_width % 2, final_height - final_height % 2)
            )
        return resized
