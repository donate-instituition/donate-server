import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CampaignCommentDocument = HydratedDocument<CampaignComment>;

@Schema({
  collection: 'campaign_comments',
  timestamps: true,
  versionKey: false,
})
export class CampaignComment {
  _id!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Campaign' })
  campaignId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  content!: string;

  createdAt!: Date;

  updatedAt!: Date;
}

export const CampaignCommentSchema =
  SchemaFactory.createForClass(CampaignComment);
