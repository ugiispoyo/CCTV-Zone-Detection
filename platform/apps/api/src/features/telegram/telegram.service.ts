import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CameraRecord, MODEL, TelegramRecipientRecord } from '@cctv/database';
import { Model } from 'mongoose';
import { CreateRecipientDto, UpdateRecipientDto } from './telegram.dto';

@Injectable()
export class TelegramService {
  constructor(
    @InjectModel(MODEL.recipient) private readonly recipients: Model<TelegramRecipientRecord>,
    @InjectModel(MODEL.camera) private readonly cameras: Model<CameraRecord>,
  ) {}

  list() {
    return this.recipients.find().populate('cameraIds', 'name location').sort({ name: 1 }).lean();
  }

  async create(input: CreateRecipientDto) {
    await this.validate(input.cameraScope, input.cameraIds);
    return this.recipients.create(input);
  }

  async update(id: string, input: UpdateRecipientDto) {
    const current = await this.recipients.findById(id).lean();
    if (!current) throw new NotFoundException('Telegram recipient not found');
    await this.validate(
      input.cameraScope ?? current.cameraScope,
      input.cameraIds ?? current.cameraIds.map(String),
    );
    return this.recipients.findByIdAndUpdate(id, input, { new: true, runValidators: true });
  }

  async remove(id: string) {
    const recipient = await this.recipients.findByIdAndDelete(id);
    if (!recipient) throw new NotFoundException('Telegram recipient not found');
    return { deleted: true };
  }

  private async validate(scope: string, cameraIds: string[]) {
    if (scope === 'selected' && cameraIds.length === 0) {
      throw new BadRequestException('Select at least one camera');
    }
    const count = await this.cameras.countDocuments({ _id: { $in: cameraIds } });
    if (count !== cameraIds.length)
      throw new BadRequestException('One or more cameras are invalid');
  }
}
