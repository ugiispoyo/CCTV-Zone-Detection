import amqp, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';

export type MessageHandler<T> = (payload: T, raw: ConsumeMessage) => Promise<void>;

export class RabbitConnection {
  private connection?: ChannelModel;
  private channel?: Channel;
  private closing = false;
  private readonly disconnectHandlers: Array<() => void> = [];

  constructor(private readonly url: string) {}

  async connect(): Promise<Channel> {
    if (this.channel) return this.channel;
    this.connection = await amqp.connect(this.url);
    this.channel = await this.connection.createChannel();
    this.connection.on('error', () => undefined);
    this.connection.on('close', () => {
      this.connection = undefined;
      this.channel = undefined;
      if (!this.closing) this.disconnectHandlers.forEach((handler) => handler());
    });
    return this.channel;
  }

  async publish(exchange: string, routingKey: string, payload: unknown): Promise<void> {
    const channel = await this.connect();
    await channel.assertExchange(exchange, 'topic', { durable: true });
    channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), {
      contentType: 'application/json',
      deliveryMode: 2,
      timestamp: Date.now(),
    });
  }

  async consume<T>(options: {
    exchange: string;
    routingKey: string;
    queue: string;
    prefetch?: number;
    handler: MessageHandler<T>;
  }): Promise<void> {
    const channel = await this.connect();
    const deadLetterExchange = `${options.exchange}.dead`;
    await channel.assertExchange(options.exchange, 'topic', { durable: true });
    await channel.assertExchange(deadLetterExchange, 'topic', { durable: true });
    await channel.assertQueue(options.queue, {
      durable: true,
      arguments: { 'x-dead-letter-exchange': deadLetterExchange },
    });
    await channel.bindQueue(options.queue, options.exchange, options.routingKey);
    await channel.prefetch(options.prefetch ?? 4);
    await channel.consume(options.queue, async (message) => {
      if (!message) return;
      try {
        const payload = JSON.parse(message.content.toString()) as T;
        await options.handler(payload, message);
        channel.ack(message);
      } catch (error) {
        const redelivered = message.fields.redelivered;
        channel.nack(message, false, !redelivered);
      }
    });
  }

  async close(): Promise<void> {
    this.closing = true;
    await this.channel?.close();
    await this.connection?.close();
    this.channel = undefined;
    this.connection = undefined;
  }

  onDisconnect(handler: () => void): void {
    this.disconnectHandlers.push(handler);
  }
}
