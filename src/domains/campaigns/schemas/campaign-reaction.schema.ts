import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CampaignReactionDocument = HydratedDocument<CampaignReaction>;

@Schema({
  collection: 'campaign_reactions',
  timestamps: {
    createdAt: true,
    updatedAt: false,
  },
  versionKey: false,
})
export class CampaignReaction {
  _id!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Campaign' })
  campaignId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ required: true, enum: ['LIKE'], type: String, default: 'LIKE' })
  type!: 'LIKE';

  createdAt!: Date;
}

export const CampaignReactionSchema =
  SchemaFactory.createForClass(CampaignReaction);

CampaignReactionSchema.index({ campaignId: 1, userId: 1 }, { unique: true });
