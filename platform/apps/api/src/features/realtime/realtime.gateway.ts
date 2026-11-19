import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { DetectionEventMessage, EXCHANGE, QUEUE, ROUTING_KEY } from '@cctv/contracts';
import { Server } from 'socket.io';
import { MessagingService } from '../../common/messaging.module';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/realtime' })
export class RealtimeGateway {
  @WebSocketServer()
  server!: Server;

  cameraStatus(payload: unknown) {
    this.server.emit('camera.status', payload);
  }

  detectionEvent(payload: unknown) {
    this.server.emit('detection.event', payload);
  }
}

@Injectable()
export class RealtimeDetectionConsumer implements OnApplicationBootstrap {
  constructor(
    private readonly messaging: MessagingService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async onApplicationBootstrap() {
    await this.messaging.consume<DetectionEventMessage>({
      exchange: EXCHANGE.detections,
      routingKey: ROUTING_KEY.detectionCreated,
      queue: QUEUE.realtimeApi,
      prefetch: 32,
      handler: async (event) => this.realtime.detectionEvent(event),
    });
  }
}
