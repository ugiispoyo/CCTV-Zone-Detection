import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EXCHANGE, ROUTING_KEY } from '@cctv/contracts';
import { CameraRecord, MODEL, TelegramRecipientRecord, ZoneRecord } from '@cctv/database';
import { Model, Types } from 'mongoose';
import { MessagingService } from '../../common/messaging.module';
import { CreateCameraDto, UpdateCameraDto } from './camera.dto';

@Injectable()
export class CamerasService {
  constructor(
    @InjectModel(MODEL.camera) private readonly cameras: Model<CameraRecord>,
    @InjectModel(MODEL.zone) private readonly zones: Model<ZoneRecord>,
    @InjectModel(MODEL.recipient) private readonly recipients: Model<TelegramRecipientRecord>,
    private readonly messaging: MessagingService,
  ) {}

  async list() {
    const records = await this.cameras.find().sort({ name: 1 }).lean();
    return records.map((camera) => this.publicCamera(camera));
  }

  async get(id: string) {
    const camera = await this.cameras.findById(id).lean();
    if (!camera) throw new NotFoundException('Camera not found');
    return this.publicCamera(camera);
  }

  async create(input: CreateCameraDto) {
    const camera = await this.cameras.create({
      ...input,
      runtimeStatus: input.enabled ? 'connecting' : 'inactive',
    });
    await this.configurationChanged(camera.id, 'created');
    return this.publicCamera(camera.toObject());
  }

  async update(id: string, input: UpdateCameraDto) {
    const camera = await this.cameras.findByIdAndUpdate(id, input, {
      new: true,
      runValidators: true,
    });
    if (!camera) throw new NotFoundException('Camera not found');
    await this.configurationChanged(id, 'updated');
    return this.publicCamera(camera.toObject());
  }

  async setEnabled(id: string, enabled: boolean) {
    const camera = await this.cameras.findByIdAndUpdate(
      id,
      { enabled, runtimeStatus: enabled ? 'connecting' : 'inactive', lastError: null },
      { new: true },
    );
    if (!camera) throw new NotFoundException('Camera not found');
    await this.configurationChanged(id, enabled ? 'enabled' : 'disabled');
    return this.publicCamera(camera.toObject());
  }

  async remove(id: string) {
    const camera = await this.cameras.findByIdAndDelete(id);
    if (!camera) throw new NotFoundException('Camera not found');
    await Promise.all([
      this.zones.deleteMany({ cameraId: camera._id }),
      this.recipients.updateMany({}, { $pull: { cameraIds: camera._id } }),
    ]);
    await this.configurationChanged(id, 'deleted');
    return { deleted: true };
  }

  async internalList() {
    return this.cameras.find({ enabled: true }).lean();
  }

  async heartbeat(id: string, status: string, error?: string) {
    const camera = await this.cameras.findByIdAndUpdate(
      id,
      { runtimeStatus: status, lastSeenAt: new Date(), lastError: error ?? null },
      { new: true },
    );
    if (!camera) throw new NotFoundException('Camera not found');
    return this.publicCamera(camera.toObject());
  }

  private configurationChanged(cameraId: string, action: string) {
    return this.messaging.publish(EXCHANGE.configuration, ROUTING_KEY.cameraConfigurationChanged, {
      schemaVersion: '1.0',
      cameraId,
      action,
      changedAt: new Date().toISOString(),
    });
  }

  private publicCamera<T extends Record<string, any>>(camera: T) {
    const rtspUrl = String(camera.rtspUrl ?? '');
    const masked = rtspUrl.replace(/(rtsps?:\/\/)([^@]+)@/i, '$1••••••@');
    const { rtspUrl: _secret, ...rest } = camera;
    return { ...rest, id: String(camera._id), rtspUrlMasked: masked };
  }
}
