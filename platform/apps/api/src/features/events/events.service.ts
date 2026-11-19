import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { R2Storage } from '@cctv/backend-core';
import { DetectionEventRecord, MODEL } from '@cctv/database';
import { FilterQuery, Model } from 'mongoose';
import { createReadStream } from 'node:fs';
import { access, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { MediaKind } from '@cctv/contracts';

export type EventQuery = {
  cameraId?: string;
  zoneId?: string;
  status?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
};

@Injectable()
export class EventsService {
  private readonly storage?: R2Storage;
  private readonly localMediaDir: string;

  constructor(
    @InjectModel(MODEL.event) private readonly events: Model<DetectionEventRecord>,
    config: ConfigService,
  ) {
    this.localMediaDir = resolve(config.get<string>('MEDIA_STAGING_DIR') ?? './staging-media');
    const endpoint = config.get<string>('R2_ENDPOINT');
    const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY');
    const bucket = config.get<string>('R2_BUCKET');
    if (endpoint && accessKeyId && secretAccessKey && bucket) {
      this.storage = new R2Storage({
        endpoint,
        accessKeyId,
        secretAccessKey,
        bucket,
        region: config.get<string>('R2_REGION') ?? 'auto',
      });
    }
  }

  async list(query: EventQuery) {
    const filter: FilterQuery<DetectionEventRecord> = {};
    if (query.cameraId) filter.cameraId = query.cameraId;
    if (query.zoneId) filter.zoneId = query.zoneId;
    if (query.status) filter.status = query.status;
    if (query.from || query.to) {
      filter.occurredAt = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    }
    const [items, total] = await Promise.all([
      this.events
        .find(filter)
        .populate('cameraId', 'name location')
        .populate('zoneId', 'name kind')
        .sort({ occurredAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      this.events.countDocuments(filter),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async get(id: string) {
    const idQuery = id.match(/^[a-f\d]{24}$/i) ? [{ _id: id }, { eventId: id }] : [{ eventId: id }];
    const event = await this.events
      .findOne({ $or: idQuery })
      .populate('cameraId', 'name location')
      .populate('zoneId', 'name kind')
      .lean();
    if (!event) throw new NotFoundException('Event not found');
    const mediaUrls: Record<string, string> = {};
    for (const kind of ['face', 'body', 'frame', 'clip'] as const) {
      const media = event.media?.[kind];
      if (await this.hasLocalMedia(event.eventId, kind)) {
        mediaUrls[kind] = `/events/${event.eventId}/media/${kind}`;
      } else if (this.storage && media?.objectKey && !media.objectKey.startsWith('local:')) {
        mediaUrls[kind] = await this.storage.signedReadUrl(media.objectKey);
      }
    }
    return { ...event, mediaUrls };
  }

  async localMedia(eventId: string, kind: MediaKind) {
    if (!/^[0-9a-f-]{36}$/i.test(eventId)) throw new NotFoundException('Media not found');
    const file = await this.findLocalMedia(eventId, kind);
    if (!file) throw new NotFoundException('Media not found');
    const mimeType =
      kind === 'clip' ? 'video/mp4' : file.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return { stream: createReadStream(file), mimeType };
  }

  private async hasLocalMedia(eventId: string, kind: MediaKind): Promise<boolean> {
    return Boolean(await this.findLocalMedia(eventId, kind));
  }

  private async findLocalMedia(eventId: string, kind: MediaKind): Promise<string | undefined> {
    const directory = join(this.localMediaDir, eventId);
    try {
      const filename = (await readdir(directory)).find((item) => item.startsWith(`${kind}.`));
      if (!filename) return undefined;
      const file = join(directory, filename);
      await access(file);
      return file;
    } catch {
      return undefined;
    }
  }

  async summary() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [last24Hours, processing, latest] = await Promise.all([
      this.events.countDocuments({ occurredAt: { $gte: since } }),
      this.events.countDocuments({ status: { $in: ['detected', 'media-processing'] } }),
      this.events.findOne().sort({ occurredAt: -1 }).select('occurredAt eventId').lean(),
    ]);
    return { last24Hours, processing, latest };
  }
}
