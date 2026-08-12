import { AppSettingsController } from './app-settings.controller';

function createServiceMock() {
  return {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ key: 'K' }),
    upsert: jest.fn().mockResolvedValue({ key: 'K', value: 'v' }),
  };
}

describe('AppSettingsController', () => {
  it('delegates findAll to the service', async () => {
    const service = createServiceMock();
    const controller = new AppSettingsController(service as any);

    await controller.findAll();

    expect(service.findAll).toHaveBeenCalled();
  });

  it('delegates findOne to the service', async () => {
    const service = createServiceMock();
    const controller = new AppSettingsController(service as any);

    await controller.findOne('K');

    expect(service.findOne).toHaveBeenCalledWith('K');
  });

  it('merges the key param into the body when upserting', async () => {
    const service = createServiceMock();
    const controller = new AppSettingsController(service as any);
    const body = { value: 'v' } as any;

    const result = await controller.upsert('K', body);

    expect(service.upsert).toHaveBeenCalledWith({ value: 'v', key: 'K' });
    expect(result).toEqual({ key: 'K', value: 'v' });
  });
});
