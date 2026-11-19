import { Global, Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitConnection } from '@cctv/messaging';
import type { MessageHandler } from '@cctv/messaging';

@Injectable()
export class MessagingService implements OnApplicationShutdown {
  private readonly client: RabbitConnection;

  constructor(config: ConfigService) {
    this.client = new RabbitConnection(config.getOrThrow<string>('RABBITMQ_URL'));
  }

  publish(exchange: string, routingKey: string, payload: unknown) {
    return this.client.publish(exchange, routingKey, payload);
  }

  consume<T>(options: {
    exchange: string;
    routingKey: string;
    queue: string;
    prefetch?: number;
    handler: MessageHandler<T>;
  }) {
    return this.client.consume(options);
  }

  onApplicationShutdown() {
    return this.client.close();
  }
}

@Global()
@Module({ providers: [MessagingService], exports: [MessagingService] })
export class MessagingModule {}
