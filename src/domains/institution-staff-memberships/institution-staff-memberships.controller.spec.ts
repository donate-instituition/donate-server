import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { UserRole, UserStatus, UserType } from '../users/models';
import { InstitutionStaffMembershipsController } from './institution-staff-memberships.controller';

function createServiceMock() {
  return {
    create: jest.fn(),
    createStaffUser: jest.fn(),
    findAll: jest.fn(),
    findMine: jest.fn(),
    findMyTeam: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
  };
}

function currentUser(overrides?: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    sub: 'user-id',
    email: 'staff@example.com',
    roles: [UserRole.INSTITUTION_STAFF],
    type: UserType.PERSON,
    status: UserStatus.ACTIVE,
    ...overrides,
  };
}

describe('InstitutionStaffMembershipsController', () => {
  it('delegates createStaffUser with the dto and current user', () => {
    const service = createServiceMock();
    const controller = new InstitutionStaffMembershipsController(
      service as any,
    );
    const dto = { email: 'staff@example.com' } as any;
    const user = currentUser();

    controller.createStaffUser(dto, user);

    expect(service.createStaffUser).toHaveBeenCalledWith(dto, user);
  });

  it('delegates create to the service', () => {
    const service = createServiceMock();
    const controller = new InstitutionStaffMembershipsController(
      service as any,
    );
    const dto = { institutionId: 'institution-id' } as any;

    controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('delegates findMine with the current user', () => {
    const service = createServiceMock();
    const controller = new InstitutionStaffMembershipsController(
      service as any,
    );
    const user = currentUser();

    controller.findMine(user);

    expect(service.findMine).toHaveBeenCalledWith(user);
  });

  it('delegates findMyTeam with the current user', () => {
    const service = createServiceMock();
    const controller = new InstitutionStaffMembershipsController(
      service as any,
    );
    const user = currentUser();

    controller.findMyTeam(user);

    expect(service.findMyTeam).toHaveBeenCalledWith(user);
  });

  it('delegates findAll to the service', () => {
    const service = createServiceMock();
    const controller = new InstitutionStaffMembershipsController(
      service as any,
    );

    controller.findAll();

    expect(service.findAll).toHaveBeenCalled();
  });

  it('delegates findOne to the service', () => {
    const service = createServiceMock();
    const controller = new InstitutionStaffMembershipsController(
      service as any,
    );

    controller.findOne('membership-id');

    expect(service.findOne).toHaveBeenCalledWith('membership-id');
  });

  it('delegates update to the service', () => {
    const service = createServiceMock();
    const controller = new InstitutionStaffMembershipsController(
      service as any,
    );
    const dto = { role: 'MANAGER' } as any;

    controller.update('membership-id', dto);

    expect(service.update).toHaveBeenCalledWith('membership-id', dto);
  });

  it('delegates remove to the service', () => {
    const service = createServiceMock();
    const controller = new InstitutionStaffMembershipsController(
      service as any,
    );

    controller.remove('membership-id');

    expect(service.remove).toHaveBeenCalledWith('membership-id');
  });
});
