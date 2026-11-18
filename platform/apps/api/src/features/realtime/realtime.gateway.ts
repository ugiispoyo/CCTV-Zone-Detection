import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

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
