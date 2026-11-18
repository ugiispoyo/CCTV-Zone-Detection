import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CameraSchema, MODEL, TelegramRecipientSchema } from '@cctv/database';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MODEL.recipient, schema: TelegramRecipientSchema },
      { name: MODEL.camera, schema: CameraSchema },
    ]),
  ],
  controllers: [TelegramController],
  providers: [TelegramService],
})
export class TelegramModule {}
