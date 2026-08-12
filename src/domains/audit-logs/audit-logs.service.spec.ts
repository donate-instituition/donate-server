import { AuditLogsService } from './audit-logs.service';

function createAuditLogModelMock(overrides: Partial<Record<string, any>> = {}) {
  return {
    create: jest.fn().mockResolvedValue({
      _id: 'log-1',
      actorUserId: 'user-1',
      action: 'auth.login',
      targetType: 'USER',
      targetId: 'user-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    }),
    findById: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    }),
    findByIdAndUpdate: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    }),
    findByIdAndDelete: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({}),
    }),
    countDocuments: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    }),
    ...overrides,
  };
}

describe('AuditLogsService', () => {
  it('creates an audit log and maps the response', async () => {
    const auditLogModel = createAuditLogModelMock();
    const service = new AuditLogsService(auditLogModel as any);

    const result = await service.create({
      action: 'auth.login',
      targetType: 'USER',
    } as any);

    expect(auditLogModel.create).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        id: 'log-1',
        actorUserId: 'user-1',
        action: 'auth.login',
        targetType: 'USER',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    );
  });

  it('returns a plain array when not paginated', async () => {
    const auditLogModel = createAuditLogModelMock();
    const service = new AuditLogsService(auditLogModel as any);

    const result = await service.findAll();

    expect(Array.isArray(result)).toBe(true);
    expect(auditLogModel.find).toHaveBeenCalledWith({});
  });

  it('builds a login category filter', async () => {
    const auditLogModel = createAuditLogModelMock();
    const service = new AuditLogsService(auditLogModel as any);

    await service.findAll({ category: 'login' });

    const [filterArg] = auditLogModel.find.mock.calls[0];
    expect(filterArg).toEqual({
      action: { $regex: '^auth\\.', $options: 'i' },
    });
  });

  it('builds an institutions category filter', async () => {
    const auditLogModel = createAuditLogModelMock();
    const service = new AuditLogsService(auditLogModel as any);

    await service.findAll({ category: 'institutions' });

    const [filterArg] = auditLogModel.find.mock.calls[0];
    expect(filterArg.$or).toHaveLength(2);
  });

  it('builds a users category filter', async () => {
    const auditLogModel = createAuditLogModelMock();
    const service = new AuditLogsService(auditLogModel as any);

    await service.findAll({ category: 'users' });

    const [filterArg] = auditLogModel.find.mock.calls[0];
    expect(filterArg.$or).toHaveLength(2);
  });

  it('builds a search filter when no category filter is present', async () => {
    const auditLogModel = createAuditLogModelMock();
    const service = new AuditLogsService(auditLogModel as any);

    await service.findAll({ search: 'foo' });

    const [filterArg] = auditLogModel.find.mock.calls[0];
    expect(filterArg.$or).toBeUndefined();
    expect(filterArg.$and).toEqual([
      {
        $or: [
          { action: { $regex: 'foo', $options: 'i' } },
          { targetType: { $regex: 'foo', $options: 'i' } },
          { userAgent: { $regex: 'foo', $options: 'i' } },
        ],
      },
    ]);
  });

  it('combines a category filter and a search filter', async () => {
    const auditLogModel = createAuditLogModelMock();
    const service = new AuditLogsService(auditLogModel as any);

    await service.findAll({ category: 'institutions', search: 'foo' });

    const [filterArg] = auditLogModel.find.mock.calls[0];
    expect(filterArg.$or).toBeUndefined();
    expect(filterArg.$and).toHaveLength(2);
  });

  it('sorts ascending when sort is "oldest"', async () => {
    const auditLogModel = createAuditLogModelMock();
    const service = new AuditLogsService(auditLogModel as any);

    await service.findAll({ sort: 'oldest' });

    const sortMock = auditLogModel.find.mock.results[0].value.sort;
    expect(sortMock).toHaveBeenCalledWith({ createdAt: 1 });
  });

  it('sorts descending by default', async () => {
    const auditLogModel = createAuditLogModelMock();
    const service = new AuditLogsService(auditLogModel as any);

    await service.findAll();

    const sortMock = auditLogModel.find.mock.results[0].value.sort;
    expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it('returns a paginated response with summary when paginated', async () => {
    const auditLogModel = createAuditLogModelMock({
      countDocuments: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(5) }),
    });
    const service = new AuditLogsService(auditLogModel as any);

    const result = await service.findAll({ page: '2' });

    expect(result).toEqual(
      expect.objectContaining({
        items: [],
        meta: expect.objectContaining({ page: 2 }),
        summary: expect.objectContaining({ todayCount: 5 }),
      }),
    );
    expect(auditLogModel.countDocuments).toHaveBeenCalledTimes(2);
  });

  it('returns null when the audit log is not found', async () => {
    const service = new AuditLogsService(createAuditLogModelMock() as any);

    const result = await service.findOne('log-1');

    expect(result).toBeNull();
  });

  it('returns the mapped audit log when found', async () => {
    const auditLogModel = createAuditLogModelMock({
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ _id: 'log-1', action: 'x' }),
        }),
      }),
    });
    const service = new AuditLogsService(auditLogModel as any);

    const result = await service.findOne('log-1');

    expect(result).toEqual(expect.objectContaining({ id: 'log-1' }));
  });

  it('returns null when updating an audit log that does not exist', async () => {
    const service = new AuditLogsService(createAuditLogModelMock() as any);

    const result = await service.update('log-1', {} as any);

    expect(result).toBeNull();
  });

  it('returns the mapped audit log when updated', async () => {
    const auditLogModel = createAuditLogModelMock({
      findByIdAndUpdate: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest
            .fn()
            .mockResolvedValue({ _id: 'log-1', action: 'updated' }),
        }),
      }),
    });
    const service = new AuditLogsService(auditLogModel as any);

    const result = await service.update('log-1', { action: 'updated' } as any);

    expect(result).toEqual(expect.objectContaining({ action: 'updated' }));
  });

  it('removes an audit log and returns its id', async () => {
    const auditLogModel = createAuditLogModelMock();
    const service = new AuditLogsService(auditLogModel as any);

    const result = await service.remove('log-1');

    expect(auditLogModel.findByIdAndDelete).toHaveBeenCalledWith('log-1');
    expect(result).toEqual({ id: 'log-1' });
  });
});
