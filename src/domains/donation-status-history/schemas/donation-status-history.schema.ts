import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { DonationStatus } from '../../donations/models';
import { DonationStatusHistorySource } from '../models';

export type DonationStatusHistoryDocument =
  HydratedDocument<DonationStatusHistory>;

@Schema({
  collection: 'donation_status_history',
  timestamps: {
    createdAt: true,
    updatedAt: false,
  },
  versionKey: false,
})
export class DonationStatusHistory {
  _id!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Donation' })
  donationId!: Types.ObjectId;

  @Prop({
    enum: DonationStatus,
    type: String,
  })
  fromStatus?: DonationStatus;

  @Prop({
    required: true,
    enum: DonationStatus,
    type: String,
  })
  toStatus!: DonationStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  changedByUserId?: Types.ObjectId;

  @Prop({
    required: true,
    enum: DonationStatusHistorySource,
    type: String,
  })
  source!: DonationStatusHistorySource;

  @Prop({ trim: true })
  note?: string;

  createdAt!: Date;
}

export const DonationStatusHistorySchema = SchemaFactory.createForClass(
  DonationStatusHistory,
);
