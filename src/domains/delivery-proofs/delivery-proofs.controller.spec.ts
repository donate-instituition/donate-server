import { DeliveryProofsController } from './delivery-proofs.controller';

function createServiceMock() {
  return {
    create: jest.fn().mockResolvedValue({ id: 'proof-1' }),
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: 'proof-1' }),
    update: jest.fn().mockResolvedValue({ id: 'proof-1' }),
    remove: jest.fn().mockResolvedValue({ id: 'proof-1' }),
  };
}

describe('DeliveryProofsController', () => {
  it('delegates create to the service', async () => {
    const service = createServiceMock();
    const controller = new DeliveryProofsController(service as any);
    const user = { sub: 'user-1' } as any;
    const dto = { campaignId: 'c1' } as any;

    const result = await controller.create(dto, user);

    expect(service.create).toHaveBeenCalledWith(dto, user);
    expect(result).toEqual({ id: 'proof-1' });
  });

  it('delegates findAll to the service', async () => {
    const service = createServiceMock();
    const controller = new DeliveryProofsController(service as any);

    await controller.findAll();

    expect(service.findAll).toHaveBeenCalled();
  });

  it('delegates findOne to the service', async () => {
    const service = createServiceMock();
    const controller = new DeliveryProofsController(service as any);

    await controller.findOne('proof-1');

    expect(service.findOne).toHaveBeenCalledWith('proof-1');
  });

  it('delegates update to the service', async () => {
    const service = createServiceMock();
    const controller = new DeliveryProofsController(service as any);
    const dto = { description: 'x' } as any;

    await controller.update('proof-1', dto);

    expect(service.update).toHaveBeenCalledWith('proof-1', dto);
  });

  it('delegates remove to the service', async () => {
    const service = createServiceMock();
    const controller = new DeliveryProofsController(service as any);

    await controller.remove('proof-1');

    expect(service.remove).toHaveBeenCalledWith('proof-1');
  });
});
