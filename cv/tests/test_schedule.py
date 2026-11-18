from datetime import datetime
from zoneinfo import ZoneInfo

from cctv_cv.domain.models import Schedule, TimeWindow
from cctv_cv.domain.schedule import schedule_is_active, zone_is_active


def test_regular_window_uses_javascript_day_number() -> None:
    schedule = Schedule(enabled=True, days=[1], windows=[TimeWindow(start="14:00", end="17:00")])
    monday = datetime(2026, 11, 16, 15, tzinfo=ZoneInfo("Asia/Jakarta"))
    assert schedule_is_active(schedule, "Asia/Jakarta", monday)


def test_overnight_window_continues_into_next_day() -> None:
    schedule = Schedule(enabled=True, days=[1], windows=[TimeWindow(start="22:00", end="02:00")])
    tuesday = datetime(2026, 11, 17, 1, tzinfo=ZoneInfo("Asia/Jakarta"))
    assert schedule_is_active(schedule, "Asia/Jakarta", tuesday)


def test_camera_schedule_is_the_main_gate_for_custom_zone() -> None:
    camera = Schedule(enabled=True, days=[1], windows=[TimeWindow(start="14:00", end="15:00")])
    zone = Schedule(enabled=True, days=[1], windows=[TimeWindow(start="14:00", end="17:00")])
    after_camera_window = datetime(2026, 11, 16, 16, tzinfo=ZoneInfo("Asia/Jakarta"))
    assert not zone_is_active(camera, zone, "custom", "Asia/Jakarta", after_camera_window)
