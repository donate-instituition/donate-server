import { TermsController } from './terms.controller';

function createServiceMock() {
  return {
    create: jest.fn().mockResolvedValue({ id: 'term-1' }),
    findAll: jest.fn().mockResolvedValue([]),
    findCurrent: jest.fn().mockResolvedValue({ id: 'term-1' }),
    acceptCurrent: jest.fn().mockResolvedValue({ termsAccepted: true }),
    findOne: jest.fn().mockResolvedValue({ id: 'term-1' }),
    update: jest.fn().mockResolvedValue({ id: 'term-1' }),
    remove: jest.fn().mockResolvedValue({ id: 'term-1' }),
  };
}

describe('TermsController', () => {
  it('delegates create to the service', async () => {
    const service = createServiceMock();
    const controller = new TermsController(service as any);
    const dto = { version: '1.0' } as any;

    await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('delegates findAll to the service', async () => {
    const service = createServiceMock();
    const controller = new TermsController(service as any);

    await controller.findAll();

    expect(service.findAll).toHaveBeenCalled();
  });

  it('delegates findCurrent to the service', async () => {
    const service = createServiceMock();
    const controller = new TermsController(service as any);

    await controller.findCurrent();

    expect(service.findCurrent).toHaveBeenCalled();
  });

  it('delegates acceptCurrent to the service using the current user id', async () => {
    const service = createServiceMock();
    const controller = new TermsController(service as any);
    const user = { sub: 'user-1' } as any;

    await controller.acceptCurrent(user);

    expect(service.acceptCurrent).toHaveBeenCalledWith('user-1');
  });

  it('delegates findOne to the service', async () => {
    const service = createServiceMock();
    const controller = new TermsController(service as any);

    await controller.findOne('term-1');

    expect(service.findOne).toHaveBeenCalledWith('term-1');
  });

  it('delegates update to the service', async () => {
    const service = createServiceMock();
    const controller = new TermsController(service as any);
    const dto = { title: 'New' } as any;

    await controller.update('term-1', dto);

    expect(service.update).toHaveBeenCalledWith('term-1', dto);
  });

  it('delegates remove to the service', async () => {
    const service = createServiceMock();
    const controller = new TermsController(service as any);

    await controller.remove('term-1');

    expect(service.remove).toHaveBeenCalledWith('term-1');
  });
});
