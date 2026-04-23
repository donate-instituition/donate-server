import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { TaxReceiptType } from '../models';
import type { TaxReceiptMetadata } from '../models';

export type TaxReceiptDocument = HydratedDocument<TaxReceipt>;

@Schema({
  collection: 'tax_receipts',
  timestamps: {
    createdAt: true,
    updatedAt: false,
  },
  versionKey: false,
})
export class TaxReceipt {
  _id!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Donation' })
  donationId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  donorUserId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Institution' })
  institutionId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  receiptNumber!: string;

  @Prop({
    required: true,
    enum: TaxReceiptType,
    type: String,
  })
  type!: TaxReceiptType;

  @Prop({ required: true })
  amount!: number;

  @Prop({ required: true })
  issuedAt!: Date;

  @Prop({ trim: true })
  documentUrl?: string;

  @Prop({
    type: raw({
      donorCpfMasked: {
        type: String,
        trim: true,
      },
      institutionCnpj: {
        type: String,
        trim: true,
      },
      year: {
        type: Number,
      },
    }),
  })
  metadata?: TaxReceiptMetadata;

  createdAt!: Date;
}

export const TaxReceiptSchema = SchemaFactory.createForClass(TaxReceipt);
