from dataclasses import dataclass
from datetime import UTC, datetime

from cctv_cv.domain.models import CameraConfig, Detection, Point, ZoneConfig, ZoneTrigger
from cctv_cv.domain.schedule import zone_is_active


@dataclass
class _ZoneState:
    inside: bool | None = None
    side: float | None = None
    last_triggered: datetime | None = None


class ZoneEvaluator:
    def __init__(self, camera: CameraConfig, cooldown_seconds: float) -> None:
        self.camera = camera
        self.cooldown_seconds = cooldown_seconds
        self.states: dict[tuple[str, str, str], _ZoneState] = {}

    def reconfigure(self, camera: CameraConfig) -> None:
        self.camera = camera
        zone_ids = {zone.id for zone in camera.zones}
        self.states = {key: state for key, state in self.states.items() if key[0] in zone_ids}

    def update(self, detections: list[Detection], at: datetime | None = None) -> list[ZoneTrigger]:
        occurred_at = at or datetime.now(UTC)
        triggers: list[ZoneTrigger] = []
        for detection in detections:
            if detection.track_id is None:
                continue
            for zone in self.camera.zones:
                if not zone.enabled or not zone_is_active(
                    self.camera.schedule,
                    zone.schedule,
                    zone.scheduleMode,
                    self.camera.timezone,
                    occurred_at,
                ):
                    continue
                trigger = self._evaluate(zone, detection, occurred_at)
                if trigger:
                    triggers.append(trigger)
        return triggers

    def _evaluate(
        self, zone: ZoneConfig, detection: Detection, occurred_at: datetime
    ) -> ZoneTrigger | None:
        key = (zone.id, detection.object_type.value, detection.track_id or "")
        state = self.states.setdefault(key, _ZoneState())
        point = detection.box.foot
        trigger_kind: str | None = None
        direction: str | None = None

        if zone.kind == "polygon":
            inside = _point_in_polygon(point, zone.points)
            if state.inside is False and inside:
                trigger_kind = "zone-entered"
            state.inside = inside
        else:
            side = _line_side(point, zone.points[0], zone.points[1])
            if state.side is not None and _crossed(state.side, side):
                direction = "a-to-b" if state.side < side else "b-to-a"
                if zone.direction in {"both", direction}:
                    trigger_kind = "line-crossed"
            if abs(side) > 1e-6:
                state.side = side

        if trigger_kind is None or not self._cooldown_expired(state, occurred_at):
            return None
        state.last_triggered = occurred_at
        return ZoneTrigger(
            zone_id=zone.id,
            track_id=detection.track_id or "",
            object_type=detection.object_type,
            occurred_at=occurred_at,
            confidence=detection.confidence,
            object_box=detection.box,
            trigger=trigger_kind,
            direction=direction,
        )

    def _cooldown_expired(self, state: _ZoneState, now: datetime) -> bool:
        if state.last_triggered is None:
            return True
        return (now - state.last_triggered).total_seconds() >= self.cooldown_seconds


def _line_side(point: Point, first: Point, second: Point) -> float:
    return (second.x - first.x) * (point.y - first.y) - (second.y - first.y) * (point.x - first.x)


def _crossed(previous: float, current: float) -> bool:
    return (previous < -1e-6 and current > 1e-6) or (previous > 1e-6 and current < -1e-6)


def _point_in_polygon(point: Point, polygon: list[Point]) -> bool:
    inside = False
    previous = polygon[-1]
    for current in polygon:
        crosses = (current.y > point.y) != (previous.y > point.y)
        if crosses:
            boundary_x = (previous.x - current.x) * (point.y - current.y) / (
                previous.y - current.y
            ) + current.x
            if point.x < boundary_x:
                inside = not inside
        previous = current
    return inside
