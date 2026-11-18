import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { R2Storage } from '@cctv/backend-core';
import { DetectionEventRecord, MODEL } from '@cctv/database';
import { FilterQuery, Model } from 'mongoose';

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

  constructor(
    @InjectModel(MODEL.event) private readonly events: Model<DetectionEventRecord>,
    config: ConfigService,
  ) {
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
    if (this.storage) {
      for (const [kind, media] of Object.entries(event.media ?? {})) {
        if (media?.objectKey) mediaUrls[kind] = await this.storage.signedReadUrl(media.objectKey);
      }
    }
    return { ...event, mediaUrls };
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
