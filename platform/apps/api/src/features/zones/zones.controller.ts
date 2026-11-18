import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateZoneDto, UpdateZoneDto } from './zone.dto';
import { ZonesService } from './zones.service';

@ApiTags('zones')
@Controller('zones')
export class ZonesController {
  constructor(private readonly zones: ZonesService) {}

  @Get()
  list(@Query('cameraId') cameraId?: string) {
    return this.zones.list(cameraId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.zones.get(id);
  }

  @Post()
  create(@Body() input: CreateZoneDto) {
    return this.zones.create(input);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() input: UpdateZoneDto) {
    return this.zones.update(id, input);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.zones.remove(id);
  }
}
