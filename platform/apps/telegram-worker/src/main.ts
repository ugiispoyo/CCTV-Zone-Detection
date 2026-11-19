import { readFile } from 'node:fs/promises';
import { loadEnvironment, R2Storage, requiredEnv, TelegramClient } from '@cctv/backend-core';
import {
  DetectionEventMessage,
  EXCHANGE,
  MediaKind,
  MediaUploadMessage,
  QUEUE,
  ROUTING_KEY,
  StagedMedia,
} from '@cctv/contracts';
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
  const cameras = mongoose.model<CameraRecord>(MODEL.camera, CameraSchema);
  const zones = mongoose.model<ZoneRecord>(MODEL.zone, ZoneSchema);
  const events = mongoose.model<DetectionEventRecord>(MODEL.event, DetectionEventSchema);
  const recipients = mongoose.model<TelegramRecipientRecord>(
    MODEL.recipient,
    TelegramRecipientSchema,
  );
  const deliveries = mongoose.model<TelegramDeliveryRecord>(MODEL.delivery, TelegramDeliverySchema);
  const rabbit = new RabbitConnection(requiredEnv('RABBITMQ_URL'));
  rabbit.onDisconnect(() => process.exit(1));
  const telegram = new TelegramClient(requiredEnv('TELEGRAM_BOT_TOKEN'));
  const r2Config = {
    endpoint: process.env.R2_ENDPOINT,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
  };
  const storage = Object.values(r2Config).every(Boolean)
    ? new R2Storage({
        endpoint: r2Config.endpoint!,
        region: process.env.R2_REGION ?? 'auto',
        accessKeyId: r2Config.accessKeyId!,
        secretAccessKey: r2Config.secretAccessKey!,
        bucket: r2Config.bucket!,
      })
    : undefined;

  let fastCache = {
    cameras: new Map<string, CameraRecord>(),
    zones: new Map<string, ZoneRecord>(),
    recipients: [] as Array<TelegramRecipientRecord & { _id: mongoose.Types.ObjectId }>,
  };
  const refreshFastCache = async () => {
    const [cameraRecords, zoneRecords, recipientRecords] = await Promise.all([
      cameras.find().lean(),
      zones.find().lean(),
      recipients.find({ enabled: true }).lean(),
    ]);
    fastCache = {
      cameras: new Map(cameraRecords.map((camera) => [String(camera._id), camera])),
      zones: new Map(zoneRecords.map((zone) => [String(zone._id), zone])),
      recipients: recipientRecords,
    };
  };
  await refreshFastCache();
  const cacheTimer = setInterval(
    () =>
      void refreshFastCache().catch((error) => console.error('Fast cache refresh failed:', error)),
    Math.max(1000, Number(process.env.TELEGRAM_FAST_CACHE_MS ?? 5000)),
  );
  cacheTimer.unref();

  await rabbit.consume<DetectionEventMessage>({
    exchange: EXCHANGE.detections,
    routingKey: ROUTING_KEY.detectionCreated,
    queue: QUEUE.telegramFast,
    prefetch: 10,
    handler: async (event) => {
      const camera = fastCache.cameras.get(event.cameraId);
      const zone = fastCache.zones.get(event.zoneId);
      if (!camera) throw new Error(`Camera for event ${event.eventId} is not available`);
      const targets = fastCache.recipients.filter(
        (recipient) =>
          recipient.cameraScope === 'all' ||
          recipient.cameraIds.some((cameraId) => String(cameraId) === event.cameraId),
      );
      const text = [
        `<b>⚠️ ${escapeHtml(event.objectType)} terdeteksi</b>`,
        `Kamera: ${escapeHtml(camera.name)}`,
        `Zona: ${escapeHtml(zone?.name ?? 'Tanpa zona')}`,
        `Waktu: ${new Date(event.occurredAt).toLocaleString('id-ID', { timeZone: camera.timezone })}`,
        `Confidence: ${(event.confidence * 100).toFixed(1)}%`,
        '',
        '<i>Foto dan video akan menyusul.</i>',
      ].join('\n');
      await Promise.all(
        targets.map((recipient) => telegram.sendMessage({ chatId: recipient.chatId, text })),
      );
      console.log(
        JSON.stringify({
          event: 'telegram_fast_alert_sent',
          eventId: event.eventId,
          recipients: targets.length,
          latencyMs: Date.now() - new Date(event.occurredAt).getTime(),
        }),
      );
    },
  });

  const notify = async (eventId: string, stagedFiles?: Partial<Record<MediaKind, StagedMedia>>) => {
    const event = await events
      .findOne({ eventId })
      .populate<{ cameraId: CameraRecord }>('cameraId')
      .populate<{ zoneId: ZoneRecord | null }>('zoneId');
    if (!event || !event.media.clip || !event.media.body || !event.media.frame) {
      throw new Error(`Event ${eventId} is not ready for Telegram`);
    }
    if (!event.cameraId) throw new Error(`Camera for event ${eventId} is not available`);
    const cameraId = String((event.cameraId as unknown as { _id: unknown })._id);
    const targets = await recipients.find({
      enabled: true,
      $or: [{ cameraScope: 'all' }, { cameraScope: 'selected', cameraIds: cameraId }],
    });

    const caption = [
      `<b>${escapeHtml(event.objectType)} detected</b>`,
      `Camera: ${escapeHtml(event.cameraId.name)}`,
      `Zone: ${escapeHtml(event.zoneId?.name ?? 'Tanpa zona')}`,
      `Time: ${event.occurredAt.toLocaleString('id-ID', { timeZone: event.cameraId.timezone })}`,
      `Confidence: ${(event.confidence * 100).toFixed(1)}%`,
    ].join('\n');
    const loadMedia = async (kind: MediaKind, objectKey: string) => {
      const staged = stagedFiles?.[kind];
      if (staged) return readFile(staged.path);
      if (storage) return storage.download(objectKey);
      throw new Error(`Local ${kind} for event ${eventId} is unavailable and R2 is not configured`);
    };
    const photos = await Promise.all(
      [
        ['face', event.media.face],
        ['body', event.media.body],
        ['frame', event.media.frame],
      ]
        .filter((entry): entry is [string, NonNullable<typeof event.media.frame>] =>
          Boolean(entry[1]),
        )
        .map(async ([kind, media]) => ({
          data: await loadMedia(kind as MediaKind, media.objectKey),
          filename: `${kind}.jpg`,
          contentType: media.mimeType,
        })),
    );
    const video = {
      data: await loadMedia('clip', event.media.clip.objectKey),
      filename: 'clip.mp4',
      contentType: event.media.clip.mimeType,
    };

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
  };

  await rabbit.consume<MediaUploadMessage>({
    exchange: EXCHANGE.media,
    routingKey: ROUTING_KEY.mediaUploadRequested,
    queue: QUEUE.telegramLocalMedia,
    prefetch: 2,
    handler: async (message) => {
      await notify(message.eventId, message.files);
    },
  });

  await rabbit.consume<{ schemaVersion: string; eventId: string }>({
    exchange: EXCHANGE.notifications,
    routingKey: ROUTING_KEY.mediaReady,
    queue: QUEUE.telegramWorker,
    prefetch: 2,
    handler: async ({ eventId }) => {
      await notify(eventId);
    },
  });

  const pending = await events
    .find({
      status: 'ready',
      'media.clip.objectKey': { $not: /^local:/ },
    })
    .sort({ occurredAt: -1 })
    .limit(Math.max(1, Number(process.env.TELEGRAM_BACKFILL_LIMIT ?? 1)))
    .select({ eventId: 1 })
    .lean();
  for (const event of pending) {
    try {
      await notify(event.eventId);
    } catch (error) {
      console.error(`Telegram backfill failed for ${event.eventId}:`, error);
    }
  }

  const shutdown = async () => {
    clearInterval(cacheTimer);
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
