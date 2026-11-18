from dataclasses import dataclass

from cctv_cv.domain.models import Box, Detection, ObjectType


@dataclass
class _Track:
    track_id: int
    object_type: ObjectType
    box: Box
    missed: int = 0
    hits: int = 1


class IoUTracker:
    """Small per-camera tracker with replaceable interface and no model coupling."""

    def __init__(self, minimum_iou: float = 0.25, maximum_missed: int = 15) -> None:
        self.minimum_iou = minimum_iou
        self.maximum_missed = maximum_missed
        self.next_id = 1
        self.tracks: dict[int, _Track] = {}

    def update(self, detections: list[Detection]) -> list[Detection]:
        candidates = sorted(
            (
                (_iou(track.box, detection.box), track_id, detection_index)
                for track_id, track in self.tracks.items()
                for detection_index, detection in enumerate(detections)
                if track.object_type == detection.object_type
            ),
            reverse=True,
        )
        used_tracks: set[int] = set()
        used_detections: set[int] = set()
        for score, track_id, index in candidates:
            if score < self.minimum_iou or track_id in used_tracks or index in used_detections:
                continue
            track = self.tracks[track_id]
            track.box = detections[index].box
            track.missed = 0
            track.hits += 1
            detections[index].track_id = str(track_id)
            used_tracks.add(track_id)
            used_detections.add(index)

        for track_id, track in list(self.tracks.items()):
            if track_id not in used_tracks:
                track.missed += 1
                if track.missed > self.maximum_missed:
                    del self.tracks[track_id]

        for index, detection in enumerate(detections):
            if index in used_detections:
                continue
            track_id = self.next_id
            self.next_id += 1
            self.tracks[track_id] = _Track(track_id, detection.object_type, detection.box)
            detection.track_id = str(track_id)
        return detections


def _iou(first: Box, second: Box) -> float:
    left = max(first.x, second.x)
    top = max(first.y, second.y)
    right = min(first.x + first.width, second.x + second.width)
    bottom = min(first.y + first.height, second.y + second.height)
    intersection = max(0.0, right - left) * max(0.0, bottom - top)
    union = first.width * first.height + second.width * second.height - intersection
    return intersection / union if union > 0 else 0.0
