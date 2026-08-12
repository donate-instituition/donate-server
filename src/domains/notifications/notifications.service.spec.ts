import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { UserRole, UserStatus, UserType } from '../users/models';
import { NotificationType } from './models';
import { NotificationsService } from './notifications.service';

const USER_ID = '507f1f77bcf86cd799439011';

const currentUser: AuthenticatedUser = {
  sub: USER_ID,
  email: 'user@test.com',
  roles: [UserRole.DONOR],
  type: UserType.PERSON,
  status: UserStatus.ACTIVE,
};

function buildNotification(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'notif-1',
    userId: new Types.ObjectId(USER_ID),
    type: NotificationType.NEW_MESSAGE,
    title: 'Title',
    body: 'Body',
    data: { conversationId: 'conv-1' },
    readAt: undefined,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('NotificationsService', () => {
  function createService(overrides: {
    notificationModel?: any;
    rabbitMqPublisherService?: any;
  } = {}) {
    const rabbitMqPublisherService =
      overrides.rabbitMqPublisherService ?? {
        publish: jest.fn().mockResolvedValue(undefined),
      };
    const notificationModel = overrides.notificationModel ?? {
      create: jest.fn().mockResolvedValue(buildNotification()),
    };
    const service = new NotificationsService(
      notificationModel as any,
      rabbitMqPublisherService as any,
    );

    return { service, notificationModel, rabbitMqPublisherService };
  }

  describe('create', () => {
    it('creates a DONATION_STATUS_UPDATED notification and publishes a push job', async () => {
      const notification = buildNotification({
        type: NotificationType.DONATION_STATUS_UPDATED,
      });
      const notificationModel = { create: jest.fn().mockResolvedValue(notification) };
      const { service, rabbitMqPublisherService } = createService({
        notificationModel,
      });

      const result = await service.create({
        userId: new Types.ObjectId(USER_ID),
        type: NotificationType.DONATION_STATUS_UPDATED,
        title: 'Title',
        body: 'Body',
      } as any);

      expect(notificationModel.create).toHaveBeenCalled();
      expect(rabbitMqPublisherService.publish).toHaveBeenCalledWith(
        'notification.push',
        expect.objectContaining({
          type: 'notification.push',
          payload: expect.objectContaining({
            title: 'Title',
            body: 'Body',
          }),
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: 'notif-1',
          type: NotificationType.DONATION_STATUS_UPDATED,
        }),
      );
    });

    it('creates a NEW_FOLLOWER notification', async () => {
      const notification = buildNotification({
        type: NotificationType.NEW_FOLLOWER,
      });
      const notificationModel = { create: jest.fn().mockResolvedValue(notification) };
      const { service } = createService({ notificationModel });

      const result = await service.create({
        userId: new Types.ObjectId(USER_ID),
        type: NotificationType.NEW_FOLLOWER,
        title: 'Novo seguidor',
        body: 'Alguém te seguiu',
      } as any);

      expect(result.type).toBe(NotificationType.NEW_FOLLOWER);
    });
  });

  describe('createOnceByDataField', () => {
    it('returns the existing notification when one matches the data field', async () => {
      const existing = buildNotification({
        type: NotificationType.CAMPAIGN_GOAL_REACHED,
      });
      const notificationModel = {
        findOne: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(existing),
        }),
        create: jest.fn(),
      };
      const { service, rabbitMqPublisherService } = createService({
        notificationModel,
      });

      const result = await service.createOnceByDataField(
        'campaignId',
        'camp-1',
        {
          userId: new Types.ObjectId(USER_ID),
          type: NotificationType.CAMPAIGN_GOAL_REACHED,
          title: 'Meta atingida',
          body: 'A campanha atingiu a meta',
        } as any,
      );

      expect(notificationModel.findOne).toHaveBeenCalledWith({
        'data.campaignId': 'camp-1',
      });
      expect(notificationModel.create).not.toHaveBeenCalled();
      expect(rabbitMqPublisherService.publish).not.toHaveBeenCalled();
      expect(result.type).toBe(NotificationType.CAMPAIGN_GOAL_REACHED);
    });

    it('creates a new CAMPAIGN_UPDATE notification when none exists', async () => {
      const created = buildNotification({ type: NotificationType.CAMPAIGN_UPDATE });
      const notificationModel = {
        findOne: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
        create: jest.fn().mockResolvedValue(created),
      };
      const { service, rabbitMqPublisherService } = createService({
        notificationModel,
      });

      const result = await service.createOnceByDataField(
        'campaignId',
        'camp-1',
        {
          userId: new Types.ObjectId(USER_ID),
          type: NotificationType.CAMPAIGN_UPDATE,
          title: 'Atualização',
          body: 'A campanha foi atualizada',
        } as any,
      );

      expect(notificationModel.create).toHaveBeenCalled();
      expect(rabbitMqPublisherService.publish).toHaveBeenCalled();
      expect(result.type).toBe(NotificationType.CAMPAIGN_UPDATE);
    });
  });

  describe('findMine', () => {
    it('returns an empty array without a current user', async () => {
      const { service } = createService();

      const result = await service.findMine(undefined);

      expect(result).toEqual([]);
    });

    it('returns serialized notifications for the current user', async () => {
      const notificationModel = {
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([buildNotification()]),
            }),
          }),
        }),
      };
      const { service } = createService({ notificationModel });

      const result = await service.findMine(currentUser);

      expect(result).toEqual([
        expect.objectContaining({ id: 'notif-1', type: NotificationType.NEW_MESSAGE }),
      ]);
    });
  });

  describe('findAll', () => {
    it('returns serialized notifications', async () => {
      const notificationModel = {
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([buildNotification()]),
            }),
          }),
        }),
      };
      const { service } = createService({ notificationModel });

      const result = await service.findAll();

      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the notification does not exist', async () => {
      const notificationModel = {
        findById: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      };
      const { service } = createService({ notificationModel });

      await expect(service.findOne('notif-1')).rejects.toThrow(NotFoundException);
    });

    it('returns the serialized notification when found', async () => {
      const notificationModel = {
        findById: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(buildNotification()),
        }),
      };
      const { service } = createService({ notificationModel });

      const result = await service.findOne('notif-1');

      expect(result).toEqual(expect.objectContaining({ id: 'notif-1' }));
    });
  });

  describe('markAsRead', () => {
    it('throws NotFoundException when no notification matches', async () => {
      const notificationModel = {
        findOneAndUpdate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      };
      const { service } = createService({ notificationModel });

      await expect(
        service.markAsRead('notif-1', currentUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('scopes the update to the current user when provided', async () => {
      const updated = buildNotification({ readAt: new Date('2026-01-02T00:00:00.000Z') });
      const notificationModel = {
        findOneAndUpdate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(updated),
        }),
      };
      const { service } = createService({ notificationModel });

      const result = await service.markAsRead('notif-1', currentUser);

      expect(notificationModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'notif-1', userId: expect.any(Types.ObjectId) },
        { $set: { readAt: expect.any(Date) } },
        { returnDocument: 'after' },
      );
      expect(result.readAt).toBe('2026-01-02T00:00:00.000Z');
    });

    it('does not scope the update to a user when none is provided', async () => {
      const updated = buildNotification();
      const notificationModel = {
        findOneAndUpdate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(updated),
        }),
      };
      const { service } = createService({ notificationModel });

      await service.markAsRead('notif-1', undefined);

      expect(notificationModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'notif-1' },
        { $set: { readAt: expect.any(Date) } },
        { returnDocument: 'after' },
      );
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the notification does not exist', async () => {
      const notificationModel = {
        findByIdAndUpdate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      };
      const { service } = createService({ notificationModel });

      await expect(service.update('notif-1', {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the updated notification', async () => {
      const updated = buildNotification({ title: 'Updated title' });
      const notificationModel = {
        findByIdAndUpdate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(updated),
        }),
      };
      const { service } = createService({ notificationModel });

      const result = await service.update('notif-1', { title: 'Updated title' } as any);

      expect(result.title).toBe('Updated title');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the notification does not exist', async () => {
      const notificationModel = {
        findByIdAndDelete: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      };
      const { service } = createService({ notificationModel });

      await expect(service.remove('notif-1')).rejects.toThrow(NotFoundException);
    });

    it('removes the notification and returns its id', async () => {
      const notificationModel = {
        findByIdAndDelete: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(buildNotification()),
        }),
      };
      const { service } = createService({ notificationModel });

      const result = await service.remove('notif-1');

      expect(result).toEqual({ id: 'notif-1' });
    });
  });
});
