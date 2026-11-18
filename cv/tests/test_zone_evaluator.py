from datetime import UTC, datetime, timedelta

from cctv_cv.domain.models import (
    Box,
    CameraConfig,
    Detection,
    ObjectType,
    PreviewSettings,
    Schedule,
    ZoneConfig,
)
from cctv_cv.zones import ZoneEvaluator


def camera_with_line() -> CameraConfig:
    return CameraConfig(
        _id="camera",
        name="Gate",
        rtspUrl="rtsp://example/stream",
        schedule=Schedule(),
        preview=PreviewSettings(),
        zones=[
            ZoneConfig(
                _id="zone",
                name="Line",
                kind="line",
                points=[{"x": 0.1, "y": 0.5}, {"x": 0.9, "y": 0.5}],
            )
        ],
    )


def test_line_crossing_supports_vehicle() -> None:
    evaluator = ZoneEvaluator(camera_with_line(), cooldown_seconds=1)
    now = datetime.now(UTC)
    above = Detection(
        object_type=ObjectType.CAR,
        confidence=0.9,
        track_id="1",
        box=Box(x=0.3, y=0.1, width=0.2, height=0.2),
    )
    below = above.model_copy(update={"box": Box(x=0.3, y=0.5, width=0.2, height=0.2)})
    assert evaluator.update([above], now) == []
    events = evaluator.update([below], now + timedelta(milliseconds=100))
    assert events[0].object_type == ObjectType.CAR
    assert events[0].trigger == "line-crossed"
