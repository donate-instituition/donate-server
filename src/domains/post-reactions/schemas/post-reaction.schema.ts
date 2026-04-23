import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { PostReactionType } from '../models';

export type PostReactionDocument = HydratedDocument<PostReaction>;

@Schema({
  collection: 'post_reactions',
  timestamps: {
    createdAt: true,
    updatedAt: false,
  },
  versionKey: false,
})
export class PostReaction {
  _id!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Post' })
  postId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({
    required: true,
    enum: PostReactionType,
    type: String,
  })
  type!: PostReactionType;

  createdAt!: Date;
}

export const PostReactionSchema = SchemaFactory.createForClass(PostReaction);
