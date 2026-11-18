import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CameraSchema, MODEL, TelegramRecipientSchema, ZoneSchema } from '@cctv/database';
import { CamerasController } from './cameras.controller';
import { CamerasService } from './cameras.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MODEL.camera, schema: CameraSchema },
      { name: MODEL.zone, schema: ZoneSchema },
      { name: MODEL.recipient, schema: TelegramRecipientSchema },
    ]),
  ],
  controllers: [CamerasController],
  providers: [CamerasService],
  exports: [CamerasService],
})
export class CamerasModule {}
