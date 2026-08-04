import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { FollowTargetType } from '../models';

export type FollowDocument = HydratedDocument<Follow>;

@Schema({
  collection: 'follows',
  timestamps: {
    createdAt: true,
    updatedAt: false,
  },
  versionKey: false,
})
export class Follow {
  _id!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  followerUserId!: Types.ObjectId;

  @Prop({
    required: true,
    enum: FollowTargetType,
    type: String,
  })
  targetType!: FollowTargetType;

  @Prop({ required: true, type: Types.ObjectId })
  targetId!: Types.ObjectId;

  createdAt!: Date;
}

export const FollowSchema = SchemaFactory.createForClass(Follow);
FollowSchema.index(
  { followerUserId: 1, targetType: 1, targetId: 1 },
  { unique: true },
);
