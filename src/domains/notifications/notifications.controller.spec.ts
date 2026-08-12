import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { UserRole, UserStatus, UserType } from '../users/models';
import { NotificationsController } from './notifications.controller';

const currentUser: AuthenticatedUser = {
  sub: '507f1f77bcf86cd799439011',
  email: 'user@test.com',
  roles: [UserRole.DONOR],
  type: UserType.PERSON,
  status: UserStatus.ACTIVE,
};

describe('NotificationsController', () => {
  function createController() {
    const notificationsService = {
      create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
      findAll: jest.fn().mockResolvedValue([{ id: 'notif-1' }]),
      findMine: jest.fn().mockResolvedValue([{ id: 'notif-1' }]),
      findOne: jest.fn().mockResolvedValue({ id: 'notif-1' }),
      markAsRead: jest.fn().mockResolvedValue({ id: 'notif-1', readAt: 'now' }),
      update: jest.fn().mockResolvedValue({ id: 'notif-1' }),
      remove: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };
    const controller = new NotificationsController(notificationsService as any);

    return { controller, notificationsService };
  }

  it('delegates create to the service', async () => {
    const { controller, notificationsService } = createController();
    const dto = { title: 'hi' };

    const result = await controller.create(dto as any);

    expect(notificationsService.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'notif-1' });
  });

  it('delegates findAll to the service', async () => {
    const { controller, notificationsService } = createController();

    const result = await controller.findAll();

    expect(notificationsService.findAll).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'notif-1' }]);
  });

  it('delegates findMine to the service with the current user', async () => {
    const { controller, notificationsService } = createController();

    const result = await controller.findMine(currentUser);

    expect(notificationsService.findMine).toHaveBeenCalledWith(currentUser);
    expect(result).toEqual([{ id: 'notif-1' }]);
  });

  it('delegates findOne to the service', async () => {
    const { controller, notificationsService } = createController();

    const result = await controller.findOne('notif-1');

    expect(notificationsService.findOne).toHaveBeenCalledWith('notif-1');
    expect(result).toEqual({ id: 'notif-1' });
  });

  it('delegates markAsRead to the service', async () => {
    const { controller, notificationsService } = createController();

    const result = await controller.markAsRead('notif-1', currentUser);

    expect(notificationsService.markAsRead).toHaveBeenCalledWith(
      'notif-1',
      currentUser,
    );
    expect(result).toEqual({ id: 'notif-1', readAt: 'now' });
  });

  it('delegates update to the service', async () => {
    const { controller, notificationsService } = createController();
    const dto = { title: 'updated' };

    const result = await controller.update('notif-1', dto as any);

    expect(notificationsService.update).toHaveBeenCalledWith('notif-1', dto);
    expect(result).toEqual({ id: 'notif-1' });
  });

  it('delegates remove to the service', async () => {
    const { controller, notificationsService } = createController();

    const result = await controller.remove('notif-1');

    expect(notificationsService.remove).toHaveBeenCalledWith('notif-1');
    expect(result).toEqual({ id: 'notif-1' });
  });
});
