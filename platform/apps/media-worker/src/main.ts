import { extname, dirname } from 'node:path';
import { rm } from 'node:fs/promises';
import { loadEnvironment, R2Storage, requiredEnv } from '@cctv/backend-core';
import { EXCHANGE, MediaUploadMessage, QUEUE, ROUTING_KEY } from '@cctv/contracts';
import { DetectionEventRecord, DetectionEventSchema, MODEL } from '@cctv/database';
import { RabbitConnection } from '@cctv/messaging';
import mongoose from 'mongoose';

loadEnvironment();

async function bootstrap() {
  await mongoose.connect(requiredEnv('MONGODB_URI'), { maxPoolSize: 10 });
  const events = mongoose.model<DetectionEventRecord>(MODEL.event, DetectionEventSchema);
  const rabbit = new RabbitConnection(requiredEnv('RABBITMQ_URL'));
  rabbit.onDisconnect(() => process.exit(1));
  const storage = new R2Storage({
    endpoint: requiredEnv('R2_ENDPOINT'),
    region: process.env.R2_REGION ?? 'auto',
    accessKeyId: requiredEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: requiredEnv('R2_SECRET_ACCESS_KEY'),
    bucket: requiredEnv('R2_BUCKET'),
  });

  await rabbit.consume<MediaUploadMessage>({
    exchange: EXCHANGE.media,
    routingKey: ROUTING_KEY.mediaUploadRequested,
    queue: QUEUE.mediaWorker,
    prefetch: 2,
    handler: async (message) => {
      const event = await events.findOne({ eventId: message.eventId });
      if (!event) throw new Error(`Detection event ${message.eventId} is not available yet`);
      event.status = 'media-processing';
      await event.save();

      const date = event.occurredAt;
      const prefix = `events/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}/${event.eventId}`;
      const media: Record<string, unknown> = {};
      for (const [kind, file] of Object.entries(message.files)) {
        if (!file) continue;
        const objectKey = `${prefix}/${kind}${extname(file.path)}`;
        await storage.upload({
          objectKey,
          filePath: file.path,
          contentType: file.mimeType,
          checksum: file.checksum,
        });
        media[kind] = {
          objectKey,
          mimeType: file.mimeType,
          size: file.size,
          checksum: file.checksum,
        };
      }

      await events.updateOne(
        { eventId: message.eventId },
        { $set: { status: 'ready', media, failureReason: null } },
      );
      await rabbit.publish(EXCHANGE.notifications, ROUTING_KEY.mediaReady, {
        schemaVersion: '1.0',
        eventId: message.eventId,
      });
      const firstFile = Object.values(message.files).find(Boolean);
      if (firstFile) await rm(dirname(firstFile.path), { recursive: true, force: true });
    },
  });

  const shutdown = async () => {
    await rabbit.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  console.log('media-worker is waiting for staged media');
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
