import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { appSettingDefaults, AppSettingKey } from './app-settings.defaults';
import { UpsertAppSettingDto } from './dto/upsert-app-setting.dto';
import {
  AppSetting,
  AppSettingDocument,
  AppSettingValueType,
} from './schemas/app-setting.schema';

const allowedKeys = new Set(Object.values(AppSettingKey));

@Injectable()
export class AppSettingsService implements OnModuleInit {
  constructor(
    @InjectModel(AppSetting.name)
    private readonly appSettingModel: Model<AppSettingDocument>,
  ) {}

  async onModuleInit() {
    await this.ensureDefaults();
  }

  private inferValueType(value: unknown): AppSettingValueType {
    if (typeof value === 'number') return AppSettingValueType.NUMBER;
    if (typeof value === 'boolean') return AppSettingValueType.BOOLEAN;
    if (value && typeof value === 'object') return AppSettingValueType.JSON;
    return AppSettingValueType.STRING;
  }

  private normalizeValue(value: unknown, valueType: AppSettingValueType) {
    if (valueType === AppSettingValueType.NUMBER) {
      const parsed = Number(value);

      if (Number.isNaN(parsed)) {
        throw new BadRequestException('Setting value must be a valid number');
      }

      return parsed;
    }

    if (valueType === AppSettingValueType.BOOLEAN) {
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      throw new BadRequestException('Setting value must be a boolean');
    }

    if (valueType === AppSettingValueType.STRING) {
      return value === undefined || value === null ? '' : String(value);
    }

    return value;
  }

  private assertKnownKey(key: string) {
    if (!allowedKeys.has(key as AppSettingKey)) {
      throw new BadRequestException(`Unknown app setting key: ${key}`);
    }
  }

  async ensureDefaults() {
    await Promise.all(
      appSettingDefaults.map((setting) =>
        this.appSettingModel
          .updateOne(
            { key: setting.key },
            {
              $setOnInsert: {
                description: setting.description,
                isSecret: false,
                key: setting.key,
                value: setting.value,
                valueType: setting.valueType,
              },
            },
            { upsert: true },
          )
          .exec(),
      ),
    );
  }

  findAll() {
    return this.appSettingModel.find().sort({ key: 1 }).exec();
  }

  findOne(key: AppSettingKey | string) {
    return this.appSettingModel.findOne({ key }).exec();
  }

  async upsert(dto: UpsertAppSettingDto) {
    const key = dto.key?.trim();

    if (!key) {
      throw new BadRequestException('Setting key is required');
    }

    this.assertKnownKey(key);

    const valueType = dto.valueType ?? this.inferValueType(dto.value);
    const value = this.normalizeValue(dto.value, valueType);

    return this.appSettingModel
      .findOneAndUpdate(
        { key },
        {
          $set: {
            description: dto.description,
            isSecret: Boolean(dto.isSecret),
            key,
            value,
            valueType,
          },
        },
        { returnDocument: 'after', upsert: true },
      )
      .exec();
  }

  async getString(key: AppSettingKey, fallback = '') {
    const setting = await this.findOne(key);
    const value = setting?.value;

    if (value === undefined || value === null) {
      return fallback;
    }

    return String(value);
  }

  async getNumber(key: AppSettingKey, fallback = 0) {
    const setting = await this.findOne(key);
    const parsed = Number(setting?.value);

    return Number.isNaN(parsed) ? fallback : parsed;
  }
}
