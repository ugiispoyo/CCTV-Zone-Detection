from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ObjectType(StrEnum):
    PERSON = "person"
    CAR = "car"
    MOTORCYCLE = "motorcycle"
    HEAD = "head"


class Point(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class Box(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    width: float = Field(gt=0, le=1)
    height: float = Field(gt=0, le=1)

    @property
    def foot(self) -> Point:
        return Point(x=min(1, self.x + self.width / 2), y=min(1, self.y + self.height))


class TimeWindow(BaseModel):
    start: str
    end: str


class Schedule(BaseModel):
    enabled: bool = False
    days: list[int] = Field(default_factory=lambda: list(range(7)))
    windows: list[TimeWindow] = Field(default_factory=list)


class PreviewSettings(BaseModel):
    showBoundingBoxes: bool = True
    inferenceFps: int = 2
    idleTimeoutSeconds: int = 60
    quality: str = "medium"


class ZoneConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    name: str
    kind: str
    points: list[Point]
    enabled: bool = True
    scheduleMode: str = "inherit"
    schedule: Schedule | None = None
    direction: str = "both"

    @model_validator(mode="after")
    def valid_geometry(self) -> ZoneConfig:
        minimum = 2 if self.kind == "line" else 3
        if self.kind not in {"line", "polygon"} or len(self.points) < minimum:
            raise ValueError(f"invalid {self.kind} geometry")
        return self


class CameraConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    name: str
    rtspUrl: str
    timezone: str = "Asia/Jakarta"
    enabled: bool = True
    schedule: Schedule
    preview: PreviewSettings
    zones: list[ZoneConfig] = Field(default_factory=list)


class Detection(BaseModel):
    object_type: ObjectType
    confidence: float = Field(ge=0, le=1)
    box: Box
    track_id: str | None = None


class ZoneTrigger(BaseModel):
    zone_id: str
    track_id: str
    object_type: ObjectType
    occurred_at: datetime
    confidence: float
    object_box: Box
    trigger: str
    direction: str | None = None


class DetectionEvent(BaseModel):
    schemaVersion: str = "2.0"
    eventId: str
    cameraId: str
    zoneId: str
    trackId: str
    objectType: ObjectType
    occurredAt: datetime
    confidence: float
    objectBox: Box
    headBox: Box | None = None
    faceBox: Box | None = None
    trigger: str
    direction: str | None = None
