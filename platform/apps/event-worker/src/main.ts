import { loadEnvironment, requiredEnv } from '@cctv/backend-core';
import { DetectionEventMessage, EXCHANGE, QUEUE, ROUTING_KEY } from '@cctv/contracts';
import { DetectionEventRecord, DetectionEventSchema, MODEL } from '@cctv/database';
import { RabbitConnection } from '@cctv/messaging';
import mongoose from 'mongoose';

loadEnvironment();

async function bootstrap() {
  await mongoose.connect(requiredEnv('MONGODB_URI'), { maxPoolSize: 10 });
  const events = mongoose.model<DetectionEventRecord>(MODEL.event, DetectionEventSchema);
  const rabbit = new RabbitConnection(requiredEnv('RABBITMQ_URL'));
  rabbit.onDisconnect(() => process.exit(1));

  await rabbit.consume<DetectionEventMessage>({
    exchange: EXCHANGE.detections,
    routingKey: ROUTING_KEY.detectionCreated,
    queue: QUEUE.eventWorker,
    prefetch: 16,
    handler: async (event) => {
      if (event.schemaVersion !== '2.0') throw new Error('Unsupported detection schema version');
      await events.updateOne(
        { eventId: event.eventId },
        {
          $setOnInsert: {
            ...event,
            occurredAt: new Date(event.occurredAt),
            status: 'detected',
            media: {},
          },
        },
        { upsert: true, runValidators: true },
      );
    },
  });

  const shutdown = async () => {
    await rabbit.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  console.log('event-worker is consuming detection events');
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
