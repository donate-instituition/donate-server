import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { InstitutionDonationType, InstitutionStatus } from '../models';
import type {
  InstitutionAddress,
  InstitutionStats,
  InstitutionVerification,
} from '../models';

export type InstitutionDocument = HydratedDocument<Institution>;

@Schema({
  collection: 'institutions',
  timestamps: true,
  versionKey: false,
})
export class Institution {
  _id!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  legalName!: string;

  @Prop({ required: true, trim: true })
  displayName!: string;

  @Prop({ required: true, trim: true, unique: true })
  cnpj!: string;

  @Prop({ required: true, trim: true, lowercase: true })
  email!: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({
    type: [{ type: Types.ObjectId }],
    default: [],
  })
  categoryIds!: Types.ObjectId[];

  @Prop({ trim: true })
  logoUrl?: string;

  @Prop({ trim: true })
  coverPhotoUrl?: string;

  @Prop({ trim: true })
  website?: string;

  @Prop({
    required: true,
    enum: InstitutionStatus,
    type: String,
    default: InstitutionStatus.PENDING_APPROVAL,
  })
  status!: InstitutionStatus;

  @Prop({
    type: raw({
      isVerified: {
        type: Boolean,
        default: false,
      },
      verifiedAt: {
        type: Date,
      },
      verifiedByUserId: {
        type: Types.ObjectId,
        ref: 'User',
      },
    }),
    default: {
      isVerified: false,
    },
  })
  verification?: InstitutionVerification;

  @Prop({
    type: raw({
      street: {
        type: String,
        trim: true,
      },
      number: {
        type: String,
        trim: true,
      },
      district: {
        type: String,
        trim: true,
      },
      city: {
        type: String,
        trim: true,
      },
      state: {
        type: String,
        trim: true,
      },
      zipCode: {
        type: String,
        trim: true,
      },
      country: {
        type: String,
        trim: true,
      },
      location: {
        type: MongooseSchema.Types.Mixed,
        default: {
          type: 'Point',
          coordinates: [],
        },
      },
    }),
    default: {},
  })
  address?: InstitutionAddress;

  @Prop({
    type: [String],
    enum: InstitutionDonationType,
    default: [],
  })
  acceptedDonationTypes!: InstitutionDonationType[];

  @Prop({ trim: true })
  pixKey?: string;

  @Prop({ trim: true })
  stripeConnectAccountId?: string;

  @Prop({ required: true, default: false })
  acceptsRecurringDonations!: boolean;

  @Prop({ required: true, default: false })
  taxReceiptEnabled!: boolean;

  @Prop({
    type: raw({
      followersCount: {
        type: Number,
        default: 0,
      },
      campaignsCount: {
        type: Number,
        default: 0,
      },
      receivedDonationsCount: {
        type: Number,
        default: 0,
      },
      receivedAmount: {
        type: Number,
        default: 0,
      },
    }),
    default: {
      followersCount: 0,
      campaignsCount: 0,
      receivedDonationsCount: 0,
      receivedAmount: 0,
    },
  })
  stats?: InstitutionStats;

  createdAt!: Date;

  updatedAt!: Date;
}

export const InstitutionSchema = SchemaFactory.createForClass(Institution);
