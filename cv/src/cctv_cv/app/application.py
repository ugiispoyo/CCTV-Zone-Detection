import asyncio
import signal
from collections.abc import Callable
from contextlib import suppress
from types import FrameType

import structlog
import uvicorn

from cctv_cv.config import Settings
from cctv_cv.integrations import PlatformApi, RabbitMessaging
from cctv_cv.monitoring import PreviewHub, create_http_app

from .supervisor import CameraSupervisor

log = structlog.get_logger()


class LoggedServer(uvicorn.Server):
    def __init__(self, config: uvicorn.Config, on_exit: Callable[[], None]) -> None:
        super().__init__(config)
        self.on_exit = on_exit

    def handle_exit(self, sig: int, frame: FrameType | None) -> None:
        try:
            signal_name = signal.Signals(sig).name
        except ValueError:
            signal_name = str(sig)
        log.warning("shutdown_signal_received", signal=signal_name)
        self.on_exit()
        super().handle_exit(sig, frame)


class Application:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.platform = PlatformApi(settings.api_base_url)
        self.messaging = RabbitMessaging(settings.rabbitmq_url, settings.worker_id)
        self.previews = PreviewHub()
        self.supervisor = CameraSupervisor(settings, self.platform, self.messaging, self.previews)
        self.http_server = LoggedServer(
            uvicorn.Config(
                create_http_app(self.previews, lambda: self.supervisor.loaded),
                host=settings.http_host,
                port=settings.http_port,
                log_level=settings.log_level.lower(),
                access_log=False,
                timeout_graceful_shutdown=5,
            ),
            self._request_shutdown,
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
            done, _ = await asyncio.wait(
                {supervisor_task, http_task}, return_when=asyncio.FIRST_COMPLETED
            )
            for task in done:
                await task
        finally:
            self.http_server.should_exit = True
            await self.previews.close()
            await self.supervisor.stop()
            for task in (supervisor_task, http_task):
                if not task.done():
                    task.cancel()
            with suppress(asyncio.CancelledError):
                await supervisor_task
            with suppress(asyncio.CancelledError):
                await http_task
            await self.messaging.close()
            await self.platform.close()

    def _request_shutdown(self) -> None:
        asyncio.create_task(self.previews.close())

    async def _configuration_changed(self) -> None:
        await asyncio.sleep(0.5)
        await self.supervisor.refresh()
