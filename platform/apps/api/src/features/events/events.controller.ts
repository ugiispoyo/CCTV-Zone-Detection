import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { MediaKind } from '@cctv/contracts';
import type { FastifyReply } from 'fastify';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { EventsService } from './events.service';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get('summary')
  summary() {
    return this.events.summary();
  }

  @Get()
  @ApiQuery({ name: 'cameraId', required: false })
  @ApiQuery({ name: 'zoneId', required: false })
  @ApiQuery({ name: 'status', required: false })
  list(
    @Query('cameraId') cameraId?: string,
    @Query('zoneId') zoneId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '24',
  ) {
    return this.events.list({
      cameraId,
      zoneId,
      status,
      from,
      to,
      page: Math.max(1, Number(page) || 1),
      limit: Math.min(100, Math.max(1, Number(limit) || 24)),
    });
  }

  @Get(':eventId/media/:kind')
  async media(
    @Param('eventId') eventId: string,
    @Param('kind') kind: MediaKind,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    if (!['face', 'body', 'frame', 'clip'].includes(kind)) {
      throw new NotFoundException('Media not found');
    }
    const media = await this.events.localMedia(eventId, kind);
    reply.header('Content-Type', media.mimeType);
    reply.header('Cache-Control', 'private, max-age=3600');
    return new StreamableFile(media.stream);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.events.get(id);
  }
}
