import { Module } from '@nestjs/common';
import { CamerasModule } from '../cameras/cameras.module';
import { ZonesModule } from '../zones/zones.module';
import { InternalController } from './internal.controller';
import { MediaStagingService } from './media-staging.service';

@Module({
  imports: [CamerasModule, ZonesModule],
  controllers: [InternalController],
  providers: [MediaStagingService],
})
export class InternalModule {}
