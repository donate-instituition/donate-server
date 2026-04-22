import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { UserRole, UserStatus, UserType } from '../models';
import type { UserSettings, UserStats } from '../models';

export type UserDocument = HydratedDocument<User>;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class User {
  _id!: Types.ObjectId;

  @Prop({
    required: true,
    enum: UserType,
    type: String,
    default: UserType.PERSON,
  })
  type!: UserType;

  @Prop({
    required: true,
    enum: UserRole,
    type: String,
  })
  role!: UserRole;

  @Prop({ required: true, trim: true })
  fullName!: string;

  @Prop({
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  })
  email!: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true })
  cpf?: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop()
  birthDate?: Date;

  @Prop({ trim: true })
  profilePhotoUrl?: string;

  @Prop({ trim: true })
  bio?: string;

  @Prop({
    required: true,
    enum: UserStatus,
    type: String,
    default: UserStatus.PENDING_VERIFICATION,
  })
  status!: UserStatus;

  @Prop({ required: true, default: false })
  isVerified!: boolean;

  @Prop({
    required: true,
    type: MongooseSchema.Types.Mixed,
    default: {},
  })
  settings!: UserSettings;

  @Prop({
    required: true,
    type: MongooseSchema.Types.Mixed,
    default: {},
  })
  stats!: UserStats;

  createdAt!: Date;

  updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
