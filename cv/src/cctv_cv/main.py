import asyncio

from cctv_cv.app import Application
from cctv_cv.common.logging import configure_logging
from cctv_cv.config import get_settings


async def async_main() -> None:
    settings = get_settings()
    configure_logging(settings.log_level)
    await Application(settings).run()


def run() -> None:
    try:
        asyncio.run(async_main())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    run()
