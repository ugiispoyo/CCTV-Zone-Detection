import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CameraSchema, MODEL, ZoneSchema } from '@cctv/database';
import { ZonesController } from './zones.controller';
import { ZonesService } from './zones.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MODEL.zone, schema: ZoneSchema },
      { name: MODEL.camera, schema: CameraSchema },
    ]),
  ],
  controllers: [ZonesController],
  providers: [ZonesService],
  exports: [ZonesService],
})
export class ZonesModule {}
