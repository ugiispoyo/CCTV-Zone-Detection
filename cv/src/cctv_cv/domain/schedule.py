from datetime import datetime, time
from zoneinfo import ZoneInfo

from .models import Schedule


def schedule_is_active(schedule: Schedule, timezone: str, at: datetime | None = None) -> bool:
    if not schedule.enabled:
        return True
    local = (at or datetime.now(tz=ZoneInfo(timezone))).astimezone(ZoneInfo(timezone))
    # Platform uses JavaScript day numbering: Sunday=0, Monday=1.
    day = (local.weekday() + 1) % 7
    previous_day = (day - 1) % 7
    current = local.time().replace(tzinfo=None)

    for window in schedule.windows:
        start = time.fromisoformat(window.start)
        end = time.fromisoformat(window.end)
        if start <= end:
            if day in schedule.days and start <= current < end:
                return True
        elif (day in schedule.days and current >= start) or (
            previous_day in schedule.days and current < end
        ):
            return True
    return False


def zone_is_active(
    camera_schedule: Schedule,
    zone_schedule: Schedule | None,
    schedule_mode: str,
    timezone: str,
    at: datetime | None = None,
) -> bool:
    camera_active = schedule_is_active(camera_schedule, timezone, at)
    if not camera_active:
        return False
    if schedule_mode == "custom" and zone_schedule:
        return schedule_is_active(zone_schedule, timezone, at)
    return True
