import threading
import time
from unittest.mock import patch

import numpy as np

from cctv_cv.cameras.capture import RtspCapture


class FakeVideoCapture:
    release_thread: str | None = None

    def __init__(self, _url: str, _backend: int) -> None:
        self.released = False
        self.counter = 0

    def set(self, _property: int, _value: int) -> bool:
        return True

    def isOpened(self) -> bool:
        return True

    def read(self) -> tuple[bool, np.ndarray | None]:
        if self.released:
            return False, None
        self.counter += 1
        time.sleep(0.002)
        return True, np.full((2, 2, 3), self.counter, dtype=np.uint8)

    def release(self) -> None:
        type(self).release_thread = threading.current_thread().name
        self.released = True


def test_capture_skips_buffered_frames() -> None:
    FakeVideoCapture.release_thread = None
    with patch("cctv_cv.cameras.capture.cv2.VideoCapture", FakeVideoCapture):
        capture = RtspCapture("rtsp://camera", read_timeout=0.1)
        assert capture.open()
        first_ok, first = capture.read()
        time.sleep(0.02)
        second_ok, second = capture.read()
        capture.close()

    assert first_ok and first is not None
    assert second_ok and second is not None
    assert int(second[0, 0, 0]) > int(first[0, 0, 0]) + 1
    assert not any(thread.name == "rtsp-latest-frame" for thread in threading.enumerate())
    assert FakeVideoCapture.release_thread == "rtsp-latest-frame"


def test_capture_read_times_out_without_a_frame() -> None:
    capture = RtspCapture("rtsp://camera", read_timeout=0.01)
    capture.capture = FakeVideoCapture("", 0)  # type: ignore[assignment]
    started = time.monotonic()

    success, frame = capture.read()

    assert not success
    assert frame is None
    assert time.monotonic() - started < 0.1
