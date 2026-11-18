import os

os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")

import cv2
import numpy as np


class RtspCapture:
    def __init__(self, url: str) -> None:
        self.url = url
        self.capture: cv2.VideoCapture | None = None

    def open(self) -> bool:
        self.close()
        self.capture = cv2.VideoCapture(self.url, cv2.CAP_FFMPEG)
        self.capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        return self.capture.isOpened()

    def read(self) -> tuple[bool, np.ndarray | None]:
        if self.capture is None:
            return False, None
        success, frame = self.capture.read()
        return success, frame if success else None

    def close(self) -> None:
        if self.capture is not None:
            self.capture.release()
            self.capture = None
