import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CameraEnabledDto, CreateCameraDto, UpdateCameraDto } from './camera.dto';
import { CamerasService } from './cameras.service';

@ApiTags('cameras')
@Controller('cameras')
export class CamerasController {
  constructor(private readonly cameras: CamerasService) {}

  @Get()
  list() {
    return this.cameras.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.cameras.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'Add a custom RTSP camera' })
  create(@Body() input: CreateCameraDto) {
    return this.cameras.create(input);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() input: UpdateCameraDto) {
    return this.cameras.update(id, input);
  }

  @Put(':id/enabled')
  setEnabled(@Param('id') id: string, @Body() input: CameraEnabledDto) {
    return this.cameras.setEnabled(id, input.enabled);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cameras.remove(id);
  }
}
