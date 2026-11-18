import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DetectionEventSchema, MODEL } from '@cctv/database';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: MODEL.event, schema: DetectionEventSchema }])],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
