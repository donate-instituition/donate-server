import { ReportsController } from './reports.controller';

function createServiceMock() {
  return {
    create: jest.fn().mockReturnValue({ id: 'report-1' }),
    findAll: jest.fn().mockReturnValue([]),
    findOne: jest.fn().mockReturnValue({ id: 'report-1' }),
    update: jest.fn().mockReturnValue({ id: 'report-1' }),
    remove: jest.fn().mockReturnValue({ id: 'report-1' }),
  };
}

describe('ReportsController', () => {
  it('delegates create to the service', () => {
    const service = createServiceMock();
    const controller = new ReportsController(service as any);
    const dto = { reporterUserId: 'u1' } as any;

    const result = controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'report-1' });
  });

  it('delegates findAll to the service', () => {
    const service = createServiceMock();
    const controller = new ReportsController(service as any);

    controller.findAll();

    expect(service.findAll).toHaveBeenCalled();
  });

  it('delegates findOne to the service', () => {
    const service = createServiceMock();
    const controller = new ReportsController(service as any);

    controller.findOne('report-1');

    expect(service.findOne).toHaveBeenCalledWith('report-1');
  });

  it('delegates update to the service', () => {
    const service = createServiceMock();
    const controller = new ReportsController(service as any);
    const dto = { status: 'RESOLVED' } as any;

    controller.update('report-1', dto);

    expect(service.update).toHaveBeenCalledWith('report-1', dto);
  });

  it('delegates remove to the service', () => {
    const service = createServiceMock();
    const controller = new ReportsController(service as any);

    controller.remove('report-1');

    expect(service.remove).toHaveBeenCalledWith('report-1');
  });
});
