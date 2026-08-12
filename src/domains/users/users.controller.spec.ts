import { UnauthorizedException } from '@nestjs/common';

import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { UserRole, UserStatus, UserType } from './models';
import { UsersController } from './users.controller';

function createServiceMock() {
  return {
    create: jest.fn(),
    findAdminDetail: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    registerPushToken: jest.fn(),
    remove: jest.fn(),
    unregisterPushToken: jest.fn(),
    update: jest.fn(),
  };
}

function currentUser(overrides?: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    sub: 'user-id',
    email: 'donor@example.com',
    roles: [UserRole.DONOR],
    type: UserType.PERSON,
    status: UserStatus.ACTIVE,
    ...overrides,
  };
}

describe('UsersController', () => {
  it('delegates create to the service', () => {
    const usersService = createServiceMock();
    const controller = new UsersController(usersService as any);
    const dto = { email: 'a@example.com' } as any;

    controller.create(dto);

    expect(usersService.create).toHaveBeenCalledWith(dto);
  });

  it('delegates findAll with the query to the service', () => {
    const usersService = createServiceMock();
    const controller = new UsersController(usersService as any);
    const query = { page: '1' };

    controller.findAll(query);

    expect(usersService.findAll).toHaveBeenCalledWith(query);
  });

  it('registers the current user push token', () => {
    const usersService = createServiceMock();
    const controller = new UsersController(usersService as any);
    const dto = { token: 'push-token' } as any;

    controller.registerMyPushToken(dto, currentUser());

    expect(usersService.registerPushToken).toHaveBeenCalledWith(
      'user-id',
      dto,
    );
  });

  it('throws when registering a push token without an authenticated user', () => {
    const usersService = createServiceMock();
    const controller = new UsersController(usersService as any);

    expect(() =>
      controller.registerMyPushToken({ token: 'push-token' } as any, undefined),
    ).toThrow(UnauthorizedException);
    expect(usersService.registerPushToken).not.toHaveBeenCalled();
  });

  it('unregisters the current user push token', () => {
    const usersService = createServiceMock();
    const controller = new UsersController(usersService as any);
    const dto = { token: 'push-token' } as any;

    controller.unregisterMyPushToken(dto, currentUser());

    expect(usersService.unregisterPushToken).toHaveBeenCalledWith(
      'user-id',
      dto,
    );
  });

  it('throws when unregistering a push token without an authenticated user', () => {
    const usersService = createServiceMock();
    const controller = new UsersController(usersService as any);

    expect(() =>
      controller.unregisterMyPushToken(
        { token: 'push-token' } as any,
        undefined,
      ),
    ).toThrow(UnauthorizedException);
    expect(usersService.unregisterPushToken).not.toHaveBeenCalled();
  });

  it('delegates findAdminDetail to the service', () => {
    const usersService = createServiceMock();
    const controller = new UsersController(usersService as any);

    controller.findAdminDetail('user-id');

    expect(usersService.findAdminDetail).toHaveBeenCalledWith('user-id');
  });

  it('delegates findOne to the service', () => {
    const usersService = createServiceMock();
    const controller = new UsersController(usersService as any);

    controller.findOne('user-id');

    expect(usersService.findOne).toHaveBeenCalledWith('user-id');
  });

  it('delegates update to the service', () => {
    const usersService = createServiceMock();
    const controller = new UsersController(usersService as any);
    const dto = { fullName: 'New Name' } as any;

    controller.update('user-id', dto);

    expect(usersService.update).toHaveBeenCalledWith('user-id', dto);
  });

  it('delegates remove to the service', () => {
    const usersService = createServiceMock();
    const controller = new UsersController(usersService as any);

    controller.remove('user-id');

    expect(usersService.remove).toHaveBeenCalledWith('user-id');
  });
});
