import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { InstitutionVerificationStatus } from '../models';

export type InstitutionDocument = HydratedDocument<Institution>;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class Institution {
  _id!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  razaoSocial!: string;

  @Prop({ required: true, trim: true })
  nomeFantasia!: string;

  @Prop({ required: true, trim: true, unique: true })
  cnpj!: string;

  @Prop({ required: true, trim: true })
  description!: string;

  @Prop({ trim: true })
  category?: string;

  @Prop({ required: true, trim: true, lowercase: true })
  contactEmail!: string;

  @Prop({ trim: true })
  contactPhone?: string;

  @Prop({ trim: true })
  websiteUrl?: string;

  @Prop({ trim: true })
  pixKey?: string;

  @Prop({
    required: true,
    enum: InstitutionVerificationStatus,
    type: String,
    default: InstitutionVerificationStatus.PENDING,
  })
  verificationStatus!: InstitutionVerificationStatus;

  @Prop({ type: Types.ObjectId, ref: 'Address' })
  addressId?: Types.ObjectId;

  createdAt!: Date;

  updatedAt!: Date;
}

export const InstitutionSchema = SchemaFactory.createForClass(Institution);
