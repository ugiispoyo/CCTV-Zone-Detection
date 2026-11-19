import { Global, Module } from '@nestjs/common';
import { RealtimeDetectionConsumer, RealtimeGateway } from './realtime.gateway';

@Global()
@Module({
  providers: [RealtimeGateway, RealtimeDetectionConsumer],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
