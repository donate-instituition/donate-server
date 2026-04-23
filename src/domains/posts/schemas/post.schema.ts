import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { PostAuthorType, PostMediaType, PostVisibility } from '../models';
import type { PostMedia, PostStats } from '../models';

export type PostDocument = HydratedDocument<Post>;

@Schema({
  collection: 'posts',
  timestamps: true,
  versionKey: false,
})
export class Post {
  _id!: Types.ObjectId;

  @Prop({
    required: true,
    enum: PostAuthorType,
    type: String,
  })
  authorType!: PostAuthorType;

  @Prop({ required: true, type: Types.ObjectId })
  authorId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Campaign' })
  campaignId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Institution' })
  institutionId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  content!: string;

  @Prop({
    type: [
      raw({
        type: {
          type: String,
          enum: PostMediaType,
        },
        url: {
          type: String,
          trim: true,
        },
      }),
    ],
    default: [],
  })
  media!: PostMedia[];

  @Prop({
    required: true,
    enum: PostVisibility,
    type: String,
    default: PostVisibility.PUBLIC,
  })
  visibility!: PostVisibility;

  @Prop({
    type: raw({
      likesCount: {
        type: Number,
        default: 0,
      },
      commentsCount: {
        type: Number,
        default: 0,
      },
      sharesCount: {
        type: Number,
        default: 0,
      },
    }),
    default: {
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
    },
  })
  stats?: PostStats;

  createdAt!: Date;

  updatedAt!: Date;
}

export const PostSchema = SchemaFactory.createForClass(Post);
