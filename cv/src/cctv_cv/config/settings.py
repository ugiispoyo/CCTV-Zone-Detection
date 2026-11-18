from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="CV_",
        case_sensitive=False,
        extra="ignore",
    )

    environment: str = "development"
    worker_id: str = "cv-local-01"
    api_base_url: str = "http://localhost:4000/api"
    rabbitmq_url: str = "amqp://cctv:cctv-local-password@localhost:5672/"
    http_host: str = "0.0.0.0"
    http_port: int = Field(default=8090, ge=1, le=65535)

    model_path: str = "yolo11n.pt"
    model_device: str = "cpu"
    model_image_size: int = Field(default=640, ge=320, le=1920)
    target_classes: str = "person,car,motorcycle,head"
    detection_confidence: float = Field(default=0.45, ge=0, le=1)
    detection_iou: float = Field(default=0.50, ge=0, le=1)
    detection_fps: float = Field(default=5, gt=0, le=60)
    capture_fps: float = Field(default=10, gt=0, le=60)

    face_model_path: Path = Path("models/face_detection_yunet_2023mar.onnx")
    face_confidence: float = Field(default=0.85, ge=0, le=1)
    head_model_path: Path | None = None
    head_model_class_id: int = Field(default=0, ge=0)
    clip_seconds: float = Field(default=10, ge=1, le=60)
    clip_fps: float = Field(default=10, ge=1, le=30)
    clip_width: int = Field(default=1280, ge=320, le=3840)
    jpeg_quality: int = Field(default=85, ge=40, le=100)
    event_cooldown_seconds: float = Field(default=15, ge=0)

    config_refresh_seconds: float = Field(default=60, ge=5)
    heartbeat_seconds: float = Field(default=20, ge=5)
    spool_dir: Path = Path("data/spool")
    spool_max_gb: float = Field(default=20, gt=0)
    log_level: str = "INFO"

    @property
    def target_class_names(self) -> frozenset[str]:
        return frozenset(value.strip().lower() for value in self.target_classes.split(",") if value)


@lru_cache
def get_settings() -> Settings:
    return Settings()
