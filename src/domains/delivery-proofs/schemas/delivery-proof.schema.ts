import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import type { DeliveryProofMetadata } from '../models';

export type DeliveryProofDocument = HydratedDocument<DeliveryProof>;

@Schema({
  collection: 'delivery_proofs',
  timestamps: {
    createdAt: true,
    updatedAt: false,
  },
  versionKey: false,
})
export class DeliveryProof {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Donation' })
  donationId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Campaign' })
  campaignId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  photoUrl!: string;

  @Prop({ trim: true })
  fileName?: string;

  @Prop({ trim: true })
  contentType?: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  confirmedByUserId?: Types.ObjectId;

  @Prop()
  confirmedAt?: Date;

  @Prop({
    type: raw({
      latitude: {
        type: Number,
      },
      longitude: {
        type: Number,
      },
      deviceInfo: {
        type: String,
        trim: true,
      },
    }),
  })
  metadata?: DeliveryProofMetadata;

  createdAt!: Date;
}

export const DeliveryProofSchema = SchemaFactory.createForClass(DeliveryProof);
