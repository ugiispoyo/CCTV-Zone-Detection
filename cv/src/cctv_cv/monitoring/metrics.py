from prometheus_client import Counter, Gauge, Histogram

CAMERA_CONNECTED = Gauge("cv_camera_connected", "RTSP connection state", ["camera_id"])
CAMERA_FRAMES = Counter("cv_camera_frames_total", "Frames read", ["camera_id"])
DETECTIONS = Counter("cv_detections_total", "Detected targets", ["camera_id", "object_type"])
EVENTS = Counter("cv_zone_events_total", "Zone events", ["camera_id", "object_type", "trigger"])
INFERENCE_SECONDS = Histogram("cv_inference_seconds", "Detector duration", ["camera_id"])
MEDIA_UPLOADS = Counter("cv_media_uploads_total", "Media upload result", ["status"])
SPOOL_BYTES = Gauge("cv_spool_bytes", "Local event spool size")
