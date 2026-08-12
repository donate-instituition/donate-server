const connect = jest.fn();

jest.mock('amqplib', () => ({
  connect: (...args: unknown[]) => connect(...args),
}));

import { env } from '../config/env';
import { createQueueMessage } from './queue-message';
import { RabbitMqPublisherService } from './rabbitmq-publisher.service';

describe('RabbitMqPublisherService', () => {
  const originalRabbitmqUrl = env.rabbitmqUrl;
  const originalRabbitmqExchange = env.rabbitmqExchange;
  let channel: {
    assertExchange: jest.Mock;
    close: jest.Mock;
    publish: jest.Mock;
  };
  let connection: { close: jest.Mock; createChannel: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    env.rabbitmqUrl = 'amqp://localhost:5672';
    env.rabbitmqExchange = 'donate.jobs';
    channel = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn().mockReturnValue(true),
    };
    connection = {
      close: jest.fn().mockResolvedValue(undefined),
      createChannel: jest.fn().mockResolvedValue(channel),
    };
    connect.mockResolvedValue(connection);
  });

  afterAll(() => {
    env.rabbitmqUrl = originalRabbitmqUrl;
    env.rabbitmqExchange = originalRabbitmqExchange;
  });

  describe('publish', () => {
    it('skips publishing without connecting when rabbitmq is not configured', async () => {
      env.rabbitmqUrl = '';
      const service = new RabbitMqPublisherService();
      const message = createQueueMessage({ payload: { a: 1 }, type: 'test' });

      await service.publish('routing.key', message);

      expect(connect).not.toHaveBeenCalled();
    });

    it('connects, asserts the exchange, and publishes the message', async () => {
      const service = new RabbitMqPublisherService();
      const message = createQueueMessage({ payload: { a: 1 }, type: 'test' });

      await service.publish('routing.key', message);

      expect(connect).toHaveBeenCalledWith('amqp://localhost:5672');
      expect(connection.createChannel).toHaveBeenCalledTimes(1);
      expect(channel.assertExchange).toHaveBeenCalledWith(
        'donate.jobs',
        'direct',
        { durable: true },
      );
      expect(channel.publish).toHaveBeenCalledWith(
        'donate.jobs',
        'routing.key',
        Buffer.from(JSON.stringify(message)),
        { contentType: 'application/json', persistent: true },
      );
    });

    it('reuses the existing channel on a second publish instead of reconnecting', async () => {
      const service = new RabbitMqPublisherService();
      const message = createQueueMessage({ payload: { a: 1 }, type: 'test' });

      await service.publish('routing.key', message);
      await service.publish('routing.key.2', message);

      expect(connect).toHaveBeenCalledTimes(1);
      expect(connection.createChannel).toHaveBeenCalledTimes(1);
      expect(channel.publish).toHaveBeenCalledTimes(2);
    });

    it('swallows a connection failure and does not publish', async () => {
      connect.mockRejectedValue(new Error('connection refused'));
      const service = new RabbitMqPublisherService();
      const message = createQueueMessage({ payload: { a: 1 }, type: 'test' });

      await expect(
        service.publish('routing.key', message),
      ).resolves.toBeUndefined();
      expect(channel.publish).not.toHaveBeenCalled();
    });
  });

  describe('onApplicationShutdown', () => {
    it('closes the channel and connection when they were opened', async () => {
      const service = new RabbitMqPublisherService();
      const message = createQueueMessage({ payload: { a: 1 }, type: 'test' });
      await service.publish('routing.key', message);

      await service.onApplicationShutdown();

      expect(channel.close).toHaveBeenCalledTimes(1);
      expect(connection.close).toHaveBeenCalledTimes(1);
    });

    it('does nothing when no channel or connection was ever opened', async () => {
      const service = new RabbitMqPublisherService();

      await expect(service.onApplicationShutdown()).resolves.toBeUndefined();
    });

    it('swallows errors thrown while closing', async () => {
      const service = new RabbitMqPublisherService();
      const message = createQueueMessage({ payload: { a: 1 }, type: 'test' });
      await service.publish('routing.key', message);
      channel.close.mockRejectedValue(new Error('already closed'));
      connection.close.mockRejectedValue(new Error('already closed'));

      await expect(service.onApplicationShutdown()).resolves.toBeUndefined();
    });
  });
});
