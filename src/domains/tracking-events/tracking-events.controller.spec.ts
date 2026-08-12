import { TrackingEventsController } from './tracking-events.controller';

function createServiceMock() {
  return {
    create: jest.fn().mockReturnValue({ id: 'event-1' }),
    findAll: jest.fn().mockReturnValue([]),
    findOne: jest.fn().mockReturnValue({ id: 'event-1' }),
    update: jest.fn().mockReturnValue({ id: 'event-1' }),
    remove: jest.fn().mockReturnValue({ id: 'event-1' }),
  };
}

describe('TrackingEventsController', () => {
  it('delegates create to the service', () => {
    const service = createServiceMock();
    const controller = new TrackingEventsController(service as any);
    const dto = { donationId: 'd1' } as any;

    const result = controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'event-1' });
  });

  it('delegates findAll to the service', () => {
    const service = createServiceMock();
    const controller = new TrackingEventsController(service as any);

    controller.findAll();

    expect(service.findAll).toHaveBeenCalled();
  });

  it('delegates findOne to the service', () => {
    const service = createServiceMock();
    const controller = new TrackingEventsController(service as any);

    controller.findOne('event-1');

    expect(service.findOne).toHaveBeenCalledWith('event-1');
  });

  it('delegates update to the service', () => {
    const service = createServiceMock();
    const controller = new TrackingEventsController(service as any);
    const dto = { description: 'x' } as any;

    controller.update('event-1', dto);

    expect(service.update).toHaveBeenCalledWith('event-1', dto);
  });

  it('delegates remove to the service', () => {
    const service = createServiceMock();
    const controller = new TrackingEventsController(service as any);

    controller.remove('event-1');

    expect(service.remove).toHaveBeenCalledWith('event-1');
  });
});
