import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { ConversationType } from '../models';

export type ConversationDocument = HydratedDocument<Conversation>;

@Schema({
  collection: 'conversations',
  timestamps: true,
  versionKey: false,
})
export class Conversation {
  _id!: Types.ObjectId;

  @Prop({
    required: true,
    enum: ConversationType,
    type: String,
  })
  type!: ConversationType;

  @Prop({
    required: true,
    type: [{ type: Types.ObjectId, ref: 'User' }],
    default: [],
  })
  participantIds!: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Institution' })
  institutionId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Campaign' })
  campaignId?: Types.ObjectId;

  @Prop()
  lastMessageAt?: Date;

  createdAt!: Date;

  updatedAt!: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
