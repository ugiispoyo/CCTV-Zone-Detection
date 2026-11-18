import { loadEnvironment, R2Storage, requiredEnv, TelegramClient } from '@cctv/backend-core';
import { EXCHANGE, QUEUE, ROUTING_KEY } from '@cctv/contracts';
import {
  CameraRecord,
  CameraSchema,
  DetectionEventRecord,
  DetectionEventSchema,
  MODEL,
  TelegramDeliveryRecord,
  TelegramDeliverySchema,
  TelegramRecipientRecord,
  TelegramRecipientSchema,
  ZoneRecord,
  ZoneSchema,
} from '@cctv/database';
import { RabbitConnection } from '@cctv/messaging';
import mongoose from 'mongoose';

loadEnvironment();

const escapeHtml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

async function bootstrap() {
  await mongoose.connect(requiredEnv('MONGODB_URI'), { maxPoolSize: 10 });
  mongoose.model<CameraRecord>(MODEL.camera, CameraSchema);
  mongoose.model<ZoneRecord>(MODEL.zone, ZoneSchema);
  const events = mongoose.model<DetectionEventRecord>(MODEL.event, DetectionEventSchema);
  const recipients = mongoose.model<TelegramRecipientRecord>(
    MODEL.recipient,
    TelegramRecipientSchema,
  );
  const deliveries = mongoose.model<TelegramDeliveryRecord>(MODEL.delivery, TelegramDeliverySchema);
  const rabbit = new RabbitConnection(requiredEnv('RABBITMQ_URL'));
  rabbit.onDisconnect(() => process.exit(1));
  const telegram = new TelegramClient(requiredEnv('TELEGRAM_BOT_TOKEN'));
  const storage = new R2Storage({
    endpoint: requiredEnv('R2_ENDPOINT'),
    region: process.env.R2_REGION ?? 'auto',
    accessKeyId: requiredEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: requiredEnv('R2_SECRET_ACCESS_KEY'),
    bucket: requiredEnv('R2_BUCKET'),
  });

  await rabbit.consume<{ schemaVersion: string; eventId: string }>({
    exchange: EXCHANGE.notifications,
    routingKey: ROUTING_KEY.mediaReady,
    queue: QUEUE.telegramWorker,
    prefetch: 2,
    handler: async ({ eventId }) => {
      const event = await events
        .findOne({ eventId })
        .populate<{ cameraId: CameraRecord }>('cameraId')
        .populate<{ zoneId: ZoneRecord }>('zoneId');
      if (!event || !event.media.clip || !event.media.body || !event.media.frame) {
        throw new Error(`Event ${eventId} is not ready for Telegram`);
      }
      const cameraId = String((event.cameraId as unknown as { _id: unknown })._id);
      const targets = await recipients.find({
        enabled: true,
        $or: [{ cameraScope: 'all' }, { cameraScope: 'selected', cameraIds: cameraId }],
      });

      const caption = [
        `<b>${escapeHtml(event.objectType)} detected</b>`,
        `Camera: ${escapeHtml(event.cameraId.name)}`,
        `Zone: ${escapeHtml(event.zoneId.name)}`,
        `Time: ${event.occurredAt.toLocaleString('id-ID', { timeZone: event.cameraId.timezone })}`,
        `Confidence: ${(event.confidence * 100).toFixed(1)}%`,
      ].join('\n');
      const photos = await Promise.all(
        [event.media.face, event.media.body, event.media.frame]
          .filter(Boolean)
          .map((media) => storage.signedReadUrl(media!.objectKey)),
      );
      const video = await storage.signedReadUrl(event.media.clip.objectKey);

      for (const recipient of targets) {
        const previous = await deliveries.findOne({ eventId, recipientId: recipient._id });
        if (previous?.status === 'sent') continue;
        const delivery = await deliveries.findOneAndUpdate(
          { eventId, recipientId: recipient._id },
          { $set: { chatId: recipient.chatId, status: 'pending' }, $inc: { attempts: 1 } },
          { upsert: true, new: true },
        );
        try {
          await telegram.sendMediaGroup({ chatId: recipient.chatId, caption, photos, video });
          await delivery.updateOne({ status: 'sent', sentAt: new Date(), error: null });
        } catch (error) {
          await delivery.updateOne({ status: 'failed', error: String(error) });
          throw error;
        }
      }
      await events.updateOne({ eventId }, { $set: { status: 'notified' } });
    },
  });

  const shutdown = async () => {
    await rabbit.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  console.log('telegram-worker is waiting for ready events');
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
