import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { Channel, ChannelModel, connect } from 'amqplib';

import { env } from '../config/env';
import type { QueueMessage } from './queue-message';

@Injectable()
export class RabbitMqPublisherService implements OnApplicationShutdown {
  private readonly logger = new Logger(RabbitMqPublisherService.name);
  private channel?: Channel;
  private connection?: ChannelModel;

  async onApplicationShutdown() {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  async publish<TPayload>(routingKey: string, message: QueueMessage<TPayload>) {
    if (!env.rabbitmqUrl) {
      this.logger.warn(
        JSON.stringify({
          event: 'rabbitmq_publish_skipped_not_configured',
          routingKey,
        }),
      );
      return;
    }

    const channel = await this.getChannel().catch((error) => {
      this.logger.warn(
        `RabbitMQ is unavailable; message will not be published to ${routingKey}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return undefined;
    });

    if (!channel) {
      return;
    }
    const published = channel.publish(
      env.rabbitmqExchange,
      routingKey,
      Buffer.from(JSON.stringify(message)),
      {
        contentType: 'application/json',
        persistent: true,
      },
    );

    this.logger.debug(
      JSON.stringify({
        event: 'rabbitmq_message_published',
        idempotencyKey: message.idempotencyKey,
        published,
        routingKey,
        type: message.type,
      }),
    );
  }

  private async getChannel() {
    if (this.channel) {
      return this.channel;
    }

    const connection = await connect(env.rabbitmqUrl);
    const channel = await connection.createChannel();
    this.connection = connection;
    this.channel = channel;
    await channel.assertExchange(env.rabbitmqExchange, 'direct', {
      durable: true,
    });

    return channel;
  }
}
