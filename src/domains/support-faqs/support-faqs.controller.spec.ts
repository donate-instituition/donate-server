import { SupportFaqsController } from './support-faqs.controller';

function createServiceMock() {
  return {
    create: jest.fn().mockResolvedValue({ id: 'faq-1' }),
    findAll: jest.fn().mockResolvedValue([]),
    findCurrent: jest.fn().mockResolvedValue({ id: 'faq-1' }),
    findOne: jest.fn().mockResolvedValue({ id: 'faq-1' }),
    update: jest.fn().mockResolvedValue({ id: 'faq-1' }),
    remove: jest.fn().mockResolvedValue({ id: 'faq-1' }),
  };
}

describe('SupportFaqsController', () => {
  it('delegates create to the service', async () => {
    const service = createServiceMock();
    const controller = new SupportFaqsController(service as any);
    const dto = { version: '1.0' } as any;

    await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('delegates findAll to the service', async () => {
    const service = createServiceMock();
    const controller = new SupportFaqsController(service as any);

    await controller.findAll();

    expect(service.findAll).toHaveBeenCalled();
  });

  it('delegates findCurrent to the service', async () => {
    const service = createServiceMock();
    const controller = new SupportFaqsController(service as any);

    await controller.findCurrent();

    expect(service.findCurrent).toHaveBeenCalled();
  });

  it('delegates findOne to the service', async () => {
    const service = createServiceMock();
    const controller = new SupportFaqsController(service as any);

    await controller.findOne('faq-1');

    expect(service.findOne).toHaveBeenCalledWith('faq-1');
  });

  it('delegates update to the service', async () => {
    const service = createServiceMock();
    const controller = new SupportFaqsController(service as any);
    const dto = { title: 'New' } as any;

    await controller.update('faq-1', dto);

    expect(service.update).toHaveBeenCalledWith('faq-1', dto);
  });

  it('delegates remove to the service', async () => {
    const service = createServiceMock();
    const controller = new SupportFaqsController(service as any);

    await controller.remove('faq-1');

    expect(service.remove).toHaveBeenCalledWith('faq-1');
  });
});
