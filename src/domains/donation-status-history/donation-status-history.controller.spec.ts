import { DonationStatusHistoryController } from './donation-status-history.controller';

function createServiceMock() {
  return {
    create: jest.fn().mockReturnValue({ id: 'history-1' }),
    findAll: jest.fn().mockReturnValue([]),
    findOne: jest.fn().mockReturnValue({ id: 'history-1' }),
    update: jest.fn().mockReturnValue({ id: 'history-1' }),
    remove: jest.fn().mockReturnValue({ id: 'history-1' }),
  };
}

describe('DonationStatusHistoryController', () => {
  it('delegates create to the service', () => {
    const service = createServiceMock();
    const controller = new DonationStatusHistoryController(service as any);
    const dto = { donationId: 'd1' } as any;

    const result = controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'history-1' });
  });

  it('delegates findAll to the service', () => {
    const service = createServiceMock();
    const controller = new DonationStatusHistoryController(service as any);

    controller.findAll();

    expect(service.findAll).toHaveBeenCalled();
  });

  it('delegates findOne to the service', () => {
    const service = createServiceMock();
    const controller = new DonationStatusHistoryController(service as any);

    controller.findOne('history-1');

    expect(service.findOne).toHaveBeenCalledWith('history-1');
  });

  it('delegates update to the service', () => {
    const service = createServiceMock();
    const controller = new DonationStatusHistoryController(service as any);
    const dto = { note: 'x' } as any;

    controller.update('history-1', dto);

    expect(service.update).toHaveBeenCalledWith('history-1', dto);
  });

  it('delegates remove to the service', () => {
    const service = createServiceMock();
    const controller = new DonationStatusHistoryController(service as any);

    controller.remove('history-1');

    expect(service.remove).toHaveBeenCalledWith('history-1');
  });
});
