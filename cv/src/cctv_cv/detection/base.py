from typing import Protocol

import numpy as np

from cctv_cv.domain.models import Detection


class Detector(Protocol):
    def detect(self, frame: np.ndarray) -> list[Detection]: ...
