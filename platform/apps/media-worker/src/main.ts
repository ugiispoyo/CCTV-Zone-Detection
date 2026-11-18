import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, rm, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, resolve } from 'node:path';
import { loadEnvironment, R2Storage, requiredEnv } from '@cctv/backend-core';
import {
  EXCHANGE,
  MediaKind,
  MediaUploadMessage,
  QUEUE,
  ROUTING_KEY,
  StagedMedia,
} from '@cctv/contracts';
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
  const configuredStagingDir = process.env.MEDIA_STAGING_DIR ?? './staging-media';
  const stagingDir = isAbsolute(configuredStagingDir)
    ? configuredStagingDir
    : resolve(process.cwd(), '../api', configuredStagingDir);

  const upload = async (message: MediaUploadMessage) => {
    const event = await events.findOne({ eventId: message.eventId });
    if (!event) throw new Error(`Detection event ${message.eventId} is not available yet`);
    const alreadyUploaded = Object.values(event.media ?? {}).some(
      (media) => media?.objectKey && !media.objectKey.startsWith('local:'),
    );
    if (alreadyUploaded) {
      const firstFile = Object.values(message.files).find(Boolean);
      if (firstFile) await rm(dirname(firstFile.path), { recursive: true, force: true });
      return;
    }
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
  };

  await rabbit.consume<MediaUploadMessage>({
    exchange: EXCHANGE.media,
    routingKey: ROUTING_KEY.mediaUploadRequested,
    queue: QUEUE.mediaWorker,
    prefetch: 2,
    handler: upload,
  });

  await republishStagedMedia(rabbit, stagingDir, events);

  const shutdown = async () => {
    await rabbit.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  console.log('media-worker is waiting for staged media');
}

async function republishStagedMedia(
  rabbit: RabbitConnection,
  stagingDir: string,
  events: mongoose.Model<DetectionEventRecord>,
): Promise<void> {
  let directories;
  try {
    directories = await readdir(stagingDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const directory of directories) {
    if (!directory.isDirectory() || !/^[0-9a-f-]{36}$/i.test(directory.name)) continue;
    if (!(await events.exists({ eventId: directory.name }))) continue;
    const files = await stagedFiles(join(stagingDir, directory.name));
    if (!files.body || !files.frame || !files.clip) continue;
    await rabbit.publish(EXCHANGE.media, ROUTING_KEY.mediaUploadRequested, {
      schemaVersion: '1.0',
      eventId: directory.name,
      files,
    } satisfies MediaUploadMessage);
  }
}

async function stagedFiles(directory: string): Promise<Partial<Record<MediaKind, StagedMedia>>> {
  const result: Partial<Record<MediaKind, StagedMedia>> = {};
  const filenames = await readdir(directory);
  for (const kind of ['face', 'body', 'frame', 'clip'] as const) {
    const filename = filenames.find((item) => item.startsWith(`${kind}.`));
    if (!filename) continue;
    const path = join(directory, filename);
    const fileStat = await stat(path);
    result[kind] = {
      path,
      mimeType: kind === 'clip' ? 'video/mp4' : filename.endsWith('.png') ? 'image/png' : 'image/jpeg',
      size: fileStat.size,
      checksum: await fileChecksum(path),
    };
  }
  return result;
}

async function fileChecksum(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
