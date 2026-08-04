import { AppSettingValueType } from '../schemas/app-setting.schema';

export class UpsertAppSettingDto {
  key!: string;

  value!: unknown;

  valueType?: AppSettingValueType;

  description?: string;

  isSecret?: boolean;
}
