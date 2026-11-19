import os
import threading
import time

os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")

import cv2
import numpy as np


class RtspCapture:
    """Continuously drain RTSP and expose only the newest frame."""

    def __init__(self, url: str, read_timeout: float = 2.0) -> None:
        self.url = url
        self.read_timeout = read_timeout
        self.capture: cv2.VideoCapture | None = None
        self._condition = threading.Condition()
        self._stop = threading.Event()
        self._reader: threading.Thread | None = None
        self._latest_frame: np.ndarray | None = None
        self._sequence = 0
        self._delivered_sequence = 0
        self._reader_failed = False

    def open(self) -> bool:
        self.close()
        capture = cv2.VideoCapture(self.url, cv2.CAP_FFMPEG)
        capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        if not capture.isOpened():
            capture.release()
            return False

        with self._condition:
            stop = threading.Event()
            self._stop = stop
            self.capture = capture
            self._latest_frame = None
            self._sequence = 0
            self._delivered_sequence = 0
            self._reader_failed = False

        self._reader = threading.Thread(
            target=self._read_forever,
            args=(capture, stop),
            name="rtsp-latest-frame",
            daemon=True,
        )
        self._reader.start()
        return True

    def read(self) -> tuple[bool, np.ndarray | None]:
        deadline = time.monotonic() + self.read_timeout
        with self._condition:
            while (
                self._sequence == self._delivered_sequence
                and not self._reader_failed
                and not self._stop.is_set()
            ):
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    return False, None
                self._condition.wait(timeout=remaining)

            if self._sequence == self._delivered_sequence or self._latest_frame is None:
                return False, None
            self._delivered_sequence = self._sequence
            return True, self._latest_frame

    def close(self) -> None:
        self._stop.set()
        with self._condition:
            capture = self.capture
            reader = self._reader
            self.capture = None
            self._reader = None
            self._latest_frame = None
            self._condition.notify_all()

        if reader is not None and reader is not threading.current_thread():
            # VideoCapture.read() and release() must stay on the same thread.
            # Releasing here while FFmpeg is reading can terminate Python with
            # a native crash when a camera is disabled or reconfigured.
            reader.join(timeout=self.read_timeout + 0.5)
        elif capture is not None:
            capture.release()

    def _read_forever(self, capture: cv2.VideoCapture, stop: threading.Event) -> None:
        try:
            while not stop.is_set():
                success, frame = capture.read()
                if not success:
                    with self._condition:
                        self._reader_failed = True
                        self._condition.notify_all()
                    return
                with self._condition:
                    if stop.is_set() or self.capture is not capture:
                        return
                    self._latest_frame = frame
                    self._sequence += 1
                    self._condition.notify_all()
        finally:
            capture.release()
