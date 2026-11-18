import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EXCHANGE, ROUTING_KEY } from '@cctv/contracts';
import { CameraRecord, MODEL, ZoneRecord } from '@cctv/database';
import { Model } from 'mongoose';
import { MessagingService } from '../../common/messaging.module';
import { CreateZoneDto, UpdateZoneDto } from './zone.dto';

@Injectable()
export class ZonesService {
  constructor(
    @InjectModel(MODEL.zone) private readonly zones: Model<ZoneRecord>,
    @InjectModel(MODEL.camera) private readonly cameras: Model<CameraRecord>,
    private readonly messaging: MessagingService,
  ) {}

  async list(cameraId?: string) {
    return this.zones
      .find(cameraId ? { cameraId } : {})
      .sort({ name: 1 })
      .lean();
  }

  async get(id: string) {
    const zone = await this.zones.findById(id).lean();
    if (!zone) throw new NotFoundException('Zone not found');
    return zone;
  }

  async create(input: CreateZoneDto) {
    await this.ensureCamera(input.cameraId);
    this.validateGeometry(input.kind, input.points);
    this.validateSchedule(input.scheduleMode, input.schedule);
    const zone = await this.zones.create(input);
    await this.changed(input.cameraId, 'created', zone.id);
    return zone;
  }

  async update(id: string, input: UpdateZoneDto) {
    const current = await this.zones.findById(id);
    if (!current) throw new NotFoundException('Zone not found');
    const kind = input.kind ?? current.kind;
    const points = input.points ?? current.points;
    const scheduleMode = input.scheduleMode ?? current.scheduleMode;
    this.validateGeometry(kind, points);
    this.validateSchedule(scheduleMode, input.schedule ?? current.schedule);
    const zone = await this.zones.findByIdAndUpdate(id, input, { new: true, runValidators: true });
    await this.changed(String(current.cameraId), 'updated', id);
    return zone;
  }

  async remove(id: string) {
    const zone = await this.zones.findByIdAndDelete(id);
    if (!zone) throw new NotFoundException('Zone not found');
    await this.changed(String(zone.cameraId), 'deleted', id);
    return { deleted: true };
  }

  private async ensureCamera(id: string) {
    if (!(await this.cameras.exists({ _id: id }))) throw new NotFoundException('Camera not found');
  }

  private validateGeometry(kind: string, points: Array<{ x: number; y: number }>) {
    if (kind === 'line' && points.length !== 2) {
      throw new BadRequestException('A line requires exactly two points');
    }
    if (kind === 'polygon' && points.length < 3) {
      throw new BadRequestException('A polygon requires at least three points');
    }
  }

  private validateSchedule(mode: string, schedule?: unknown) {
    if (mode === 'custom' && !schedule) {
      throw new BadRequestException('Custom schedule is required when scheduleMode is custom');
    }
  }

  private changed(cameraId: string, action: string, zoneId: string) {
    return this.messaging.publish(EXCHANGE.configuration, ROUTING_KEY.cameraConfigurationChanged, {
      schemaVersion: '1.0',
      cameraId,
      zoneId,
      action: `zone.${action}`,
      changedAt: new Date().toISOString(),
    });
  }
}
