import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { Channel, ChannelModel, connect } from 'amqplib';

import { env } from '../../config/env';
import type { QueueMessage } from '../../queues/queue-message';
import { PushNotificationsService } from './push-notifications.service';

type PushNotificationPayload = {
  body: string;
  data?: Record<string, unknown>;
  notificationId?: string;
  title: string;
  userId: string;
};

@Injectable()
export class PushNotificationsWorkerService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(PushNotificationsWorkerService.name);
  private channel?: Channel;
  private connection?: ChannelModel;

  constructor(
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  async onModuleInit() {
    if (!env.rabbitmqUrl) {
      this.logger.warn(
        'RabbitMQ is not configured; push notification jobs will not be consumed.',
      );
      return;
    }

    try {
      const connection = await connect(env.rabbitmqUrl);
      const channel = await connection.createChannel();
      this.connection = connection;
      this.channel = channel;

      await channel.assertExchange(env.rabbitmqExchange, 'direct', {
        durable: true,
      });
      const queue = 'notification.push';
      await channel.assertQueue(queue, { durable: true });
      await channel.bindQueue(queue, env.rabbitmqExchange, 'notification.push');
      await channel.prefetch(10);
      await channel.consume(queue, async (message) => {
        if (!message) return;

        try {
          const job = JSON.parse(
            message.content.toString(),
          ) as QueueMessage<PushNotificationPayload>;
          await this.pushNotificationsService.sendToUser(job.payload);
          channel.ack(message);
        } catch (error) {
          this.logger.error(
            `Failed to send push notification: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          channel.nack(message, false, true);
        }
      });
    } catch (error) {
      this.logger.warn(
        `RabbitMQ is unavailable; push notification jobs will not be consumed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async onApplicationShutdown() {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }
}
