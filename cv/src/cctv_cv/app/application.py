import asyncio

import structlog
import uvicorn

from cctv_cv.config import Settings
from cctv_cv.integrations import PlatformApi, RabbitMessaging
from cctv_cv.monitoring import PreviewHub, create_http_app

from .supervisor import CameraSupervisor

log = structlog.get_logger()


class Application:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.platform = PlatformApi(settings.api_base_url)
        self.messaging = RabbitMessaging(settings.rabbitmq_url, settings.worker_id)
        self.previews = PreviewHub()
        self.supervisor = CameraSupervisor(settings, self.platform, self.messaging, self.previews)
        self.http_server = uvicorn.Server(
            uvicorn.Config(
                create_http_app(self.previews, lambda: self.supervisor.loaded),
                host=settings.http_host,
                port=settings.http_port,
                log_level=settings.log_level.lower(),
                access_log=False,
            )
        )

    async def run(self) -> None:
        try:
            await self.messaging.connect()
            await self.messaging.consume_configuration_changes(self._configuration_changed)
            log.info("rabbitmq_connected")
        except Exception:
            log.exception("rabbitmq_unavailable", fallback="HTTP events and config polling")

        supervisor_task = asyncio.create_task(self.supervisor.run(), name="supervisor")
        http_task = asyncio.create_task(self.http_server.serve(), name="http-server")
        try:
            await asyncio.gather(supervisor_task, http_task)
        finally:
            await self.supervisor.stop()
            await self.messaging.close()
            await self.platform.close()

    async def _configuration_changed(self) -> None:
        await asyncio.sleep(0.5)
        await self.supervisor.refresh()
