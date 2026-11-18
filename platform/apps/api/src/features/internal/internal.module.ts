import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DetectionEventSchema, MODEL } from '@cctv/database';
import { CamerasModule } from '../cameras/cameras.module';
import { ZonesModule } from '../zones/zones.module';
import { InternalController } from './internal.controller';
import { MediaStagingService } from './media-staging.service';

@Module({
  imports: [
    CamerasModule,
    ZonesModule,
    MongooseModule.forFeature([{ name: MODEL.event, schema: DetectionEventSchema }]),
  ],
  controllers: [InternalController],
  providers: [MediaStagingService],
})
export class InternalModule {}
