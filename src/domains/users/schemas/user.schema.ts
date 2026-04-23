import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import {
  UserAllowMessagesFrom,
  UserRole,
  UserStatus,
  UserType,
} from '../models';
import type { UserSettings, UserStats } from '../models';

export type UserDocument = HydratedDocument<User>;

@Schema({
  collection: 'users',
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
    type: raw({
      privateProfile: {
        type: Boolean,
        default: false,
      },
      allowMessagesFrom: {
        type: String,
        enum: UserAllowMessagesFrom,
        default: UserAllowMessagesFrom.EVERYONE,
      },
      notifications: {
        type: {
          push: {
            type: Boolean,
            default: true,
          },
          email: {
            type: Boolean,
            default: true,
          },
        },
        default: {
          push: true,
          email: true,
        },
      },
    }),
    default: {
      privateProfile: false,
      allowMessagesFrom: UserAllowMessagesFrom.EVERYONE,
      notifications: {
        push: true,
        email: true,
      },
    },
  })
  settings?: UserSettings;

  @Prop({
    type: raw({
      totalDonatedAmount: {
        type: Number,
        default: 0,
      },
      totalDonationsCount: {
        type: Number,
        default: 0,
      },
      followingInstitutionsCount: {
        type: Number,
        default: 0,
      },
      followingCampaignsCount: {
        type: Number,
        default: 0,
      },
    }),
    default: {
      totalDonatedAmount: 0,
      totalDonationsCount: 0,
      followingInstitutionsCount: 0,
      followingCampaignsCount: 0,
    },
  })
  stats?: UserStats;

  createdAt!: Date;

  updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
