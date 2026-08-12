import { appSettingDefaults, AppSettingKey } from './app-settings.defaults';
import { AppSettingsService } from './app-settings.service';
import { AppSettingValueType } from './schemas/app-setting.schema';

function createAppSettingModelMock(overrides: Partial<Record<string, any>> = {}) {
  return {
    updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
    }),
    findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    findOneAndUpdate: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    ...overrides,
  };
}

describe('AppSettingsService', () => {
  it('upserts every default setting with upsert:true', async () => {
    const appSettingModel = createAppSettingModelMock();
    const service = new AppSettingsService(appSettingModel as any);

    await service.ensureDefaults();

    expect(appSettingModel.updateOne).toHaveBeenCalledTimes(
      appSettingDefaults.length,
    );
    expect(appSettingModel.updateOne).toHaveBeenCalledWith(
      { key: appSettingDefaults[0].key },
      expect.objectContaining({ $setOnInsert: expect.any(Object) }),
      { upsert: true },
    );
  });

  it('ensures defaults are applied on module init', async () => {
    const appSettingModel = createAppSettingModelMock();
    const service = new AppSettingsService(appSettingModel as any);
    const spy = jest.spyOn(service, 'ensureDefaults');

    await service.onModuleInit();

    expect(spy).toHaveBeenCalled();
  });

  it('lists app settings sorted by key', async () => {
    const appSettingModel = createAppSettingModelMock();
    const service = new AppSettingsService(appSettingModel as any);

    await service.findAll();

    expect(appSettingModel.find).toHaveBeenCalled();
    const sortMock = appSettingModel.find.mock.results[0].value.sort;
    expect(sortMock).toHaveBeenCalledWith({ key: 1 });
  });

  it('finds a single setting by key', async () => {
    const appSettingModel = createAppSettingModelMock();
    const service = new AppSettingsService(appSettingModel as any);

    await service.findOne(AppSettingKey.EMAIL_SUPPORT_EMAIL);

    expect(appSettingModel.findOne).toHaveBeenCalledWith({
      key: AppSettingKey.EMAIL_SUPPORT_EMAIL,
    });
  });

  it('throws BadRequestException when the key is blank', async () => {
    const service = new AppSettingsService(createAppSettingModelMock() as any);

    await expect(
      service.upsert({ key: '  ', value: '1' } as any),
    ).rejects.toThrow('Setting key is required');
  });

  it('throws BadRequestException for an unknown key', async () => {
    const service = new AppSettingsService(createAppSettingModelMock() as any);

    await expect(
      service.upsert({ key: 'NOT_A_REAL_KEY', value: '1' } as any),
    ).rejects.toThrow('Unknown app setting key');
  });

  it('infers and normalizes a number value', async () => {
    const appSettingModel = createAppSettingModelMock();
    const service = new AppSettingsService(appSettingModel as any);

    await service.upsert({
      key: AppSettingKey.STRIPE_SERVICE_FEE_BPS,
      value: 500,
    } as any);

    expect(appSettingModel.findOneAndUpdate).toHaveBeenCalledWith(
      { key: AppSettingKey.STRIPE_SERVICE_FEE_BPS },
      {
        $set: expect.objectContaining({
          value: 500,
          valueType: AppSettingValueType.NUMBER,
        }),
      },
      { returnDocument: 'after', upsert: true },
    );
  });

  it('throws BadRequestException for an invalid number', async () => {
    const service = new AppSettingsService(createAppSettingModelMock() as any);

    await expect(
      service.upsert({
        key: AppSettingKey.STRIPE_SERVICE_FEE_BPS,
        value: 'abc',
        valueType: AppSettingValueType.NUMBER,
      } as any),
    ).rejects.toThrow('Setting value must be a valid number');
  });

  it('infers and normalizes a boolean value', async () => {
    const appSettingModel = createAppSettingModelMock();
    const service = new AppSettingsService(appSettingModel as any);

    await service.upsert({
      key: AppSettingKey.EMAIL_SUPPORT_EMAIL,
      value: true,
    } as any);

    expect(appSettingModel.findOneAndUpdate).toHaveBeenCalledWith(
      { key: AppSettingKey.EMAIL_SUPPORT_EMAIL },
      {
        $set: expect.objectContaining({
          value: true,
          valueType: AppSettingValueType.BOOLEAN,
        }),
      },
      { returnDocument: 'after', upsert: true },
    );
  });

  it('coerces the string "false" to a boolean', async () => {
    const appSettingModel = createAppSettingModelMock();
    const service = new AppSettingsService(appSettingModel as any);

    await service.upsert({
      key: AppSettingKey.EMAIL_SUPPORT_EMAIL,
      value: 'false',
      valueType: AppSettingValueType.BOOLEAN,
    } as any);

    expect(appSettingModel.findOneAndUpdate).toHaveBeenCalledWith(
      { key: AppSettingKey.EMAIL_SUPPORT_EMAIL },
      { $set: expect.objectContaining({ value: false }) },
      { returnDocument: 'after', upsert: true },
    );
  });

  it('throws BadRequestException for an invalid boolean', async () => {
    const service = new AppSettingsService(createAppSettingModelMock() as any);

    await expect(
      service.upsert({
        key: AppSettingKey.EMAIL_SUPPORT_EMAIL,
        value: 'maybe',
        valueType: AppSettingValueType.BOOLEAN,
      } as any),
    ).rejects.toThrow('Setting value must be a boolean');
  });

  it('infers a JSON value type for objects', async () => {
    const appSettingModel = createAppSettingModelMock();
    const service = new AppSettingsService(appSettingModel as any);

    await service.upsert({
      key: AppSettingKey.EMAIL_SUPPORT_EMAIL,
      value: { foo: 'bar' },
    } as any);

    expect(appSettingModel.findOneAndUpdate).toHaveBeenCalledWith(
      { key: AppSettingKey.EMAIL_SUPPORT_EMAIL },
      {
        $set: expect.objectContaining({
          value: { foo: 'bar' },
          valueType: AppSettingValueType.JSON,
        }),
      },
      { returnDocument: 'after', upsert: true },
    );
  });

  it('normalizes a nullish string value to an empty string', async () => {
    const appSettingModel = createAppSettingModelMock();
    const service = new AppSettingsService(appSettingModel as any);

    await service.upsert({
      key: AppSettingKey.EMAIL_SUPPORT_EMAIL,
      value: undefined,
      valueType: AppSettingValueType.STRING,
    } as any);

    expect(appSettingModel.findOneAndUpdate).toHaveBeenCalledWith(
      { key: AppSettingKey.EMAIL_SUPPORT_EMAIL },
      { $set: expect.objectContaining({ value: '' }) },
      { returnDocument: 'after', upsert: true },
    );
  });

  it('returns the string value when the setting is found', async () => {
    const appSettingModel = createAppSettingModelMock({
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ value: 42 }),
      }),
    });
    const service = new AppSettingsService(appSettingModel as any);

    const result = await service.getString(AppSettingKey.EMAIL_SUPPORT_EMAIL);

    expect(result).toBe('42');
  });

  it('returns the fallback string when the setting value is nullish', async () => {
    const service = new AppSettingsService(createAppSettingModelMock() as any);

    const result = await service.getString(
      AppSettingKey.EMAIL_SUPPORT_EMAIL,
      'fallback',
    );

    expect(result).toBe('fallback');
  });

  it('returns the parsed number when the setting is found', async () => {
    const appSettingModel = createAppSettingModelMock({
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ value: '500' }),
      }),
    });
    const service = new AppSettingsService(appSettingModel as any);

    const result = await service.getNumber(
      AppSettingKey.STRIPE_SERVICE_FEE_BPS,
    );

    expect(result).toBe(500);
  });

  it('returns the fallback number when the setting value is not numeric', async () => {
    const appSettingModel = createAppSettingModelMock({
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ value: 'not-a-number' }),
      }),
    });
    const service = new AppSettingsService(appSettingModel as any);

    const result = await service.getNumber(
      AppSettingKey.STRIPE_SERVICE_FEE_BPS,
      99,
    );

    expect(result).toBe(99);
  });
});
