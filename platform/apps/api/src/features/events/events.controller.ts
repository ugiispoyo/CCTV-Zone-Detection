import { Controller, Get, Param, Query } from '@nestjs/common';
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

  @Get(':id')
  get(@Param('id') id: string) {
    return this.events.get(id);
  }
}
