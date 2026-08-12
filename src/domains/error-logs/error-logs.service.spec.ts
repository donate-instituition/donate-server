import { ErrorLogsService } from './error-logs.service';

function createErrorLogModelMock(overrides: Partial<Record<string, any>> = {}) {
  return {
    create: jest.fn().mockResolvedValue({ _id: 'err-1' }),
    ...overrides,
  };
}

const baseDto = {
  requestId: 'req-1',
  serviceName: 'donate-server',
  serviceVersion: '1.0.0',
  statusCode: 500,
  errorName: 'Error',
  message: 'boom',
  httpMethod: 'GET',
  path: '/foo',
};

describe('ErrorLogsService', () => {
  it('persists the error log and returns the created document', async () => {
    const errorLogModel = createErrorLogModelMock();
    const service = new ErrorLogsService(errorLogModel as any);

    const result = await service.create(baseDto);

    expect(errorLogModel.create).toHaveBeenCalledWith(baseDto);
    expect(result).toEqual({ _id: 'err-1' });
  });

  it('returns null and swallows the error when persistence fails', async () => {
    const errorLogModel = createErrorLogModelMock({
      create: jest.fn().mockRejectedValue(new Error('db down')),
    });
    const service = new ErrorLogsService(errorLogModel as any);

    const result = await service.create(baseDto);

    expect(result).toBeNull();
  });

  it('logs a stringified error when the failure is not an Error instance', async () => {
    const errorLogModel = createErrorLogModelMock({
      create: jest.fn().mockRejectedValue('plain string failure'),
    });
    const service = new ErrorLogsService(errorLogModel as any);

    const result = await service.create(baseDto);

    expect(result).toBeNull();
  });
});
