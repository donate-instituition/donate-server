import { AuditLogsController } from './audit-logs.controller';

function createServiceMock() {
  return {
    create: jest.fn().mockResolvedValue({ id: 'log-1' }),
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: 'log-1' }),
    update: jest.fn().mockResolvedValue({ id: 'log-1' }),
    remove: jest.fn().mockResolvedValue({ id: 'log-1' }),
  };
}

describe('AuditLogsController', () => {
  it('delegates create to the service', async () => {
    const service = createServiceMock();
    const controller = new AuditLogsController(service as any);
    const dto = { action: 'auth.login' } as any;

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'log-1' });
  });

  it('delegates findAll to the service with the query', async () => {
    const service = createServiceMock();
    const controller = new AuditLogsController(service as any);
    const query = { category: 'login' } as any;

    await controller.findAll(query);

    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('delegates findOne to the service', async () => {
    const service = createServiceMock();
    const controller = new AuditLogsController(service as any);

    await controller.findOne('log-1');

    expect(service.findOne).toHaveBeenCalledWith('log-1');
  });

  it('delegates update to the service', async () => {
    const service = createServiceMock();
    const controller = new AuditLogsController(service as any);
    const dto = { action: 'updated' } as any;

    await controller.update('log-1', dto);

    expect(service.update).toHaveBeenCalledWith('log-1', dto);
  });

  it('delegates remove to the service', async () => {
    const service = createServiceMock();
    const controller = new AuditLogsController(service as any);

    await controller.remove('log-1');

    expect(service.remove).toHaveBeenCalledWith('log-1');
  });
});
