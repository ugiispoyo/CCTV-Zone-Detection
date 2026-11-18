import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EXCHANGE, ROUTING_KEY } from '@cctv/contracts';
import { FastifyRequest } from 'fastify';
import { MessagingService } from '../../common/messaging.module';
import { CamerasService } from '../cameras/cameras.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ZonesService } from '../zones/zones.service';
import { CameraHeartbeatDto, DetectionEventDto } from './internal.dto';
import { MediaStagingService } from './media-staging.service';

@ApiTags('internal')
@Controller('internal/v1')
export class InternalController {
  constructor(
    private readonly cameras: CamerasService,
    private readonly zones: ZonesService,
    private readonly messaging: MessagingService,
    private readonly realtime: RealtimeGateway,
    private readonly staging: MediaStagingService,
  ) {}

  @Get('cv/configuration')
  @ApiOperation({ summary: 'Return active camera, schedule, and zone configuration for CV' })
  async configuration() {
    const cameras = await this.cameras.internalList();
    return Promise.all(
      cameras.map(async (camera) => ({
        ...camera,
        zones: (await this.zones.list(String(camera._id))).filter((zone) => zone.enabled),
      })),
    );
  }

  @Post('cameras/:id/heartbeat')
  @HttpCode(202)
  async heartbeat(@Param('id') id: string, @Body() input: CameraHeartbeatDto) {
    const camera = await this.cameras.heartbeat(id, input.status, input.error);
    this.realtime.cameraStatus(camera);
    return { accepted: true };
  }

  @Post('detections')
  @HttpCode(202)
  @ApiOperation({ summary: 'HTTP fallback for publishing a CV detection event' })
  async detection(@Body() input: DetectionEventDto) {
    await this.messaging.publish(EXCHANGE.detections, ROUTING_KEY.detectionCreated, input);
    this.realtime.detectionEvent(input);
    return { accepted: true, eventId: input.eventId };
  }

  @Post('detections/:eventId/media')
  @HttpCode(202)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['body', 'frame', 'clip'],
      properties: {
        face: { type: 'string', format: 'binary' },
        body: { type: 'string', format: 'binary' },
        frame: { type: 'string', format: 'binary' },
        clip: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Stage CV-generated face/body/frame/clip files for R2 upload' })
  async media(@Param('eventId') eventId: string, @Req() request: FastifyRequest) {
    const message = await this.staging.save(eventId, request.parts());
    await this.messaging.publish(EXCHANGE.media, ROUTING_KEY.mediaUploadRequested, message);
    return { accepted: true, eventId, files: Object.keys(message.files) };
  }
}
