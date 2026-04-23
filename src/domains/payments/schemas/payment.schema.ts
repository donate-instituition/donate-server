import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { PaymentGateway, PaymentMethod, PaymentStatus } from '../models';
import type { PaymentGatewayPayload, PaymentPix } from '../models';

export type PaymentDocument = HydratedDocument<Payment>;

@Schema({
  collection: 'payments',
  timestamps: true,
  versionKey: false,
})
export class Payment {
  _id!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Donation' })
  donationId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  donorUserId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Institution' })
  institutionId!: Types.ObjectId;

  @Prop({
    required: true,
    enum: PaymentGateway,
    type: String,
  })
  gateway!: PaymentGateway;

  @Prop({ trim: true })
  gatewayTransactionId?: string;

  @Prop({
    required: true,
    enum: PaymentMethod,
    type: String,
  })
  paymentMethod!: PaymentMethod;

  @Prop({ required: true })
  amount!: number;

  @Prop({ required: true, trim: true, uppercase: true })
  currency!: string;

  @Prop({
    required: true,
    enum: PaymentStatus,
    type: String,
    default: PaymentStatus.PENDING,
  })
  status!: PaymentStatus;

  @Prop({
    type: raw({
      qrCodeText: {
        type: String,
        trim: true,
      },
      qrCodeImageUrl: {
        type: String,
        trim: true,
      },
      expiresAt: {
        type: Date,
      },
    }),
  })
  pix?: PaymentPix;

  @Prop({
    type: MongooseSchema.Types.Mixed,
  })
  gatewayPayload?: PaymentGatewayPayload;

  @Prop()
  paidAt?: Date;

  @Prop()
  refundedAt?: Date;

  createdAt!: Date;

  updatedAt!: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
