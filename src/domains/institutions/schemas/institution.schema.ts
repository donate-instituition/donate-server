import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { InstitutionStatus } from '../models';
import type {
  InstitutionAddress,
  InstitutionStats,
  InstitutionVerification,
} from '../models';

export type InstitutionDocument = HydratedDocument<Institution>;

@Schema({
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

  @Prop({ required: true, trim: true })
  description!: string;

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
    type: MongooseSchema.Types.Mixed,
    default: {},
  })
  verification?: InstitutionVerification;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    default: {},
  })
  address?: InstitutionAddress;

  @Prop({
    type: [String],
    default: [],
  })
  acceptedDonationTypes!: string[];

  @Prop({ trim: true })
  pixKey?: string;

  @Prop({ required: true, default: false })
  taxReceiptEnabled!: boolean;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    default: {},
  })
  stats?: InstitutionStats;

  createdAt!: Date;

  updatedAt!: Date;
}

export const InstitutionSchema = SchemaFactory.createForClass(Institution);
