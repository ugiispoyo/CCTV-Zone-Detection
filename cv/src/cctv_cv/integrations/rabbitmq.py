import json
from collections.abc import Awaitable, Callable

import aio_pika
import structlog
from aio_pika import DeliveryMode, ExchangeType, Message

from cctv_cv.domain.models import DetectionEvent

log = structlog.get_logger()


class RabbitMessaging:
    def __init__(self, url: str, worker_id: str) -> None:
        self.url = url
        self.worker_id = worker_id
        self.connection: aio_pika.abc.AbstractRobustConnection | None = None
        self.channel: aio_pika.abc.AbstractChannel | None = None
        self.detection_exchange: aio_pika.abc.AbstractExchange | None = None

    async def connect(self) -> None:
        self.connection = await aio_pika.connect_robust(self.url)
        channel = await self.connection.channel(publisher_confirms=True)
        self.channel = channel
        await channel.set_qos(prefetch_count=20)
        self.detection_exchange = await channel.declare_exchange(
            "cctv.detections", ExchangeType.TOPIC, durable=True
        )
        await channel.declare_exchange("cctv.configuration", ExchangeType.TOPIC, durable=True)

    async def close(self) -> None:
        if self.connection:
            await self.connection.close()

    async def publish_detection(self, event: DetectionEvent) -> None:
        if self.detection_exchange is None:
            raise RuntimeError("RabbitMQ is not connected")
        body = event.model_dump_json().encode()
        await self.detection_exchange.publish(
            Message(
                body,
                content_type="application/json",
                delivery_mode=DeliveryMode.PERSISTENT,
                message_id=event.eventId,
                type="detection.created.v2",
            ),
            routing_key="detection.created.v2",
            mandatory=True,
        )

    async def consume_configuration_changes(self, callback: Callable[[], Awaitable[None]]) -> None:
        if self.channel is None:
            raise RuntimeError("RabbitMQ is not connected")
        exchange = await self.channel.get_exchange("cctv.configuration")
        queue = await self.channel.declare_queue(
            f"cv.{self.worker_id}.configuration.v1", durable=True, auto_delete=False
        )
        await queue.bind(exchange, routing_key="camera.configuration.changed.v1")

        async def handle(message: aio_pika.abc.AbstractIncomingMessage) -> None:
            async with message.process(requeue=True):
                try:
                    json.loads(message.body)
                    await callback()
                except Exception:
                    log.exception("configuration_message_failed")
                    raise

        await queue.consume(handle)
