import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CamerasModule } from './features/cameras/cameras.module';
import { EventsModule } from './features/events/events.module';
import { HealthModule } from './features/health/health.module';
import { InternalModule } from './features/internal/internal.module';
import { RealtimeModule } from './features/realtime/realtime.module';
import { TelegramModule } from './features/telegram/telegram.module';
import { ZonesModule } from './features/zones/zones.module';
import { MessagingModule } from './common/messaging.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
        maxPoolSize: 20,
      }),
    }),
    MessagingModule,
    RealtimeModule,
    HealthModule,
    CamerasModule,
    ZonesModule,
    EventsModule,
    TelegramModule,
    InternalModule,
  ],
})
export class AppModule {}
