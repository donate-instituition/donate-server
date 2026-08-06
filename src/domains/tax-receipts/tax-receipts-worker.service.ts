import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { Channel, ChannelModel, connect } from 'amqplib';

import { env } from '../../config/env';
import type { QueueMessage } from '../../queues/queue-message';
import { TaxReceiptsService } from './tax-receipts.service';

type ReceiptGeneratePayload = {
  donationId: string;
  paymentId: string;
};

@Injectable()
export class TaxReceiptsWorkerService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(TaxReceiptsWorkerService.name);
  private channel?: Channel;
  private connection?: ChannelModel;

  constructor(private readonly taxReceiptsService: TaxReceiptsService) {}

  async onModuleInit() {
    if (!env.rabbitmqUrl) {
      this.logger.warn(
        'RabbitMQ is not configured; receipt generation jobs will not be consumed.',
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
      const queue = 'receipt.generate';
      await channel.assertQueue(queue, { durable: true });
      await channel.bindQueue(queue, env.rabbitmqExchange, 'receipt.generate');
      await channel.prefetch(3);
      await channel.consume(queue, async (message) => {
        if (!message) return;

        try {
          const job = JSON.parse(
            message.content.toString(),
          ) as QueueMessage<ReceiptGeneratePayload>;
          this.logger.log(
            JSON.stringify({
              event: 'receipt_generation_started',
              donationId: job.payload.donationId,
              paymentId: job.payload.paymentId,
            }),
          );
          await this.taxReceiptsService.generateForPayment(
            job.payload.donationId,
            job.payload.paymentId,
          );
          this.logger.log(
            JSON.stringify({
              event: 'receipt_generation_finished',
              donationId: job.payload.donationId,
              paymentId: job.payload.paymentId,
            }),
          );
          channel.ack(message);
        } catch (error) {
          this.logger.error(
            `Failed to generate receipt: ${error instanceof Error ? error.message : String(error)}`,
          );
          channel.nack(message, false, true);
        }
      });
    } catch (error) {
      this.logger.warn(
        `RabbitMQ is unavailable; receipt generation jobs will not be consumed: ${
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
