import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { UserRole, UserStatus, UserType } from '../users/models';
import { ConversationsController } from './conversations.controller';

const currentUser: AuthenticatedUser = {
  sub: '507f1f77bcf86cd799439011',
  email: 'user@test.com',
  roles: [UserRole.DONOR],
  type: UserType.PERSON,
  status: UserStatus.ACTIVE,
};

describe('ConversationsController', () => {
  function createController() {
    const conversationsService = {
      create: jest.fn().mockResolvedValue({ id: 'conv-1' }),
      ensure: jest.fn().mockResolvedValue({ id: 'conv-1' }),
      findMine: jest.fn().mockResolvedValue([{ id: 'conv-1' }]),
      findAll: jest.fn().mockResolvedValue([{ id: 'conv-1' }]),
      findOne: jest.fn().mockResolvedValue({ id: 'conv-1' }),
      findMessages: jest.fn().mockResolvedValue([{ id: 'msg-1' }]),
      sendMessage: jest.fn().mockResolvedValue({ id: 'msg-1' }),
      markAsRead: jest.fn().mockResolvedValue({ unreadCount: 0 }),
      update: jest.fn().mockResolvedValue({ id: 'conv-1' }),
      remove: jest.fn().mockResolvedValue({ id: 'conv-1' }),
    };
    const controller = new ConversationsController(conversationsService as any);

    return { controller, conversationsService };
  }

  it('delegates create to the service', async () => {
    const { controller, conversationsService } = createController();
    const dto = { type: 'DIRECT', participantIds: [] } as any;

    const result = await controller.create(dto);

    expect(conversationsService.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'conv-1' });
  });

  it('delegates ensure to the service with the current user', async () => {
    const { controller, conversationsService } = createController();
    const dto = { institutionId: 'inst-1' };

    await controller.ensure(dto, currentUser);

    expect(conversationsService.ensure).toHaveBeenCalledWith(dto, currentUser);
  });

  it('delegates findMine to the service with the current user', async () => {
    const { controller, conversationsService } = createController();

    const result = await controller.findMine(currentUser);

    expect(conversationsService.findMine).toHaveBeenCalledWith(currentUser);
    expect(result).toEqual([{ id: 'conv-1' }]);
  });

  it('delegates findAll to the service', async () => {
    const { controller, conversationsService } = createController();

    const result = await controller.findAll();

    expect(conversationsService.findAll).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'conv-1' }]);
  });

  it('delegates findOne to the service', async () => {
    const { controller, conversationsService } = createController();

    const result = await controller.findOne('conv-1', currentUser);

    expect(conversationsService.findOne).toHaveBeenCalledWith('conv-1', currentUser);
    expect(result).toEqual({ id: 'conv-1' });
  });

  it('delegates findMessages to the service', async () => {
    const { controller, conversationsService } = createController();

    const result = await controller.findMessages('conv-1', currentUser);

    expect(conversationsService.findMessages).toHaveBeenCalledWith(
      'conv-1',
      currentUser,
    );
    expect(result).toEqual([{ id: 'msg-1' }]);
  });

  it('delegates sendMessage to the service', async () => {
    const { controller, conversationsService } = createController();
    const dto = { content: 'hi' };

    const result = await controller.sendMessage('conv-1', dto, currentUser);

    expect(conversationsService.sendMessage).toHaveBeenCalledWith(
      'conv-1',
      dto,
      currentUser,
    );
    expect(result).toEqual({ id: 'msg-1' });
  });

  it('delegates markAsRead to the service', async () => {
    const { controller, conversationsService } = createController();

    const result = await controller.markAsRead('conv-1', currentUser);

    expect(conversationsService.markAsRead).toHaveBeenCalledWith(
      'conv-1',
      currentUser,
    );
    expect(result).toEqual({ unreadCount: 0 });
  });

  it('delegates update to the service', async () => {
    const { controller, conversationsService } = createController();
    const dto = { title: 'New title' };

    const result = await controller.update('conv-1', dto as any);

    expect(conversationsService.update).toHaveBeenCalledWith('conv-1', dto);
    expect(result).toEqual({ id: 'conv-1' });
  });

  it('delegates remove to the service', async () => {
    const { controller, conversationsService } = createController();

    const result = await controller.remove('conv-1');

    expect(conversationsService.remove).toHaveBeenCalledWith('conv-1');
    expect(result).toEqual({ id: 'conv-1' });
  });
});
