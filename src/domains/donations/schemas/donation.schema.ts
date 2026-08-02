import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import {
  DonationDeliveryMode,
  DonationItemCategory,
  DonationItemCondition,
  DonationItemUnit,
  DonationStatus,
  DonationType,
  DonationVisibility,
} from '../models';
import type { DonationItemDonation, DonationMoneyDonation } from '../models';

export type DonationDocument = HydratedDocument<Donation>;

@Schema({
  collection: 'donations',
  timestamps: true,
  versionKey: false,
})
export class Donation {
  _id!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  donorUserId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Institution' })
  institutionId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Campaign' })
  campaignId?: Types.ObjectId;

  @Prop({
    required: true,
    enum: DonationType,
    type: String,
  })
  type!: DonationType;

  @Prop({
    required: true,
    enum: DonationStatus,
    type: String,
    default: DonationStatus.CREATED,
  })
  status!: DonationStatus;

  @Prop({
    required: true,
    enum: DonationVisibility,
    type: String,
    default: DonationVisibility.PUBLIC,
  })
  visibility!: DonationVisibility;

  @Prop({
    type: raw({
      amount: {
        type: Number,
      },
      currency: {
        type: String,
        trim: true,
      },
    }),
  })
  moneyDonation?: DonationMoneyDonation;

  @Prop({
    type: raw({
      items: {
        type: [
          {
            category: {
              type: String,
              enum: DonationItemCategory,
            },
            name: {
              type: String,
              trim: true,
            },
            quantity: {
              type: Number,
            },
            unit: {
              type: String,
              enum: DonationItemUnit,
            },
            condition: {
              type: String,
              enum: DonationItemCondition,
            },
          },
        ],
        default: [],
      },
      estimatedValue: {
        type: Number,
      },
    }),
  })
  itemDonation?: DonationItemDonation;

  @Prop({
    required: true,
    enum: DonationDeliveryMode,
    type: String,
  })
  deliveryMode!: DonationDeliveryMode;

  @Prop()
  scheduledAt?: Date;

  @Prop({ trim: true })
  note?: string;

  @Prop({ required: true, default: false })
  receiptEligible!: boolean;

  @Prop({ trim: true })
  proofPhotoUrl?: string;

  @Prop()
  deliveredAt?: Date;

  createdAt!: Date;

  updatedAt!: Date;
}

export const DonationSchema = SchemaFactory.createForClass(Donation);
