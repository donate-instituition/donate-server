import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AppSettingDocument = HydratedDocument<AppSetting>;

export enum AppSettingValueType {
  BOOLEAN = 'boolean',
  JSON = 'json',
  NUMBER = 'number',
  STRING = 'string',
}

@Schema({
  collection: 'app_settings',
  timestamps: true,
  versionKey: false,
})
export class AppSetting {
  @Prop({ required: true, trim: true })
  key!: string;

  @Prop({ required: true, type: String, enum: AppSettingValueType })
  valueType!: AppSettingValueType;

  @Prop({ type: Object })
  value?: unknown;

  @Prop({ trim: true })
  description?: string;

  @Prop({ required: true, default: false })
  isSecret!: boolean;

  createdAt!: Date;

  updatedAt!: Date;
}

export const AppSettingSchema = SchemaFactory.createForClass(AppSetting);
AppSettingSchema.index({ key: 1 }, { unique: true });
