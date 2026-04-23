import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PostCommentDocument = HydratedDocument<PostComment>;

@Schema({
  collection: 'post_comments',
  timestamps: true,
  versionKey: false,
})
export class PostComment {
  _id!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Post' })
  postId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'PostComment' })
  parentCommentId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  content!: string;

  createdAt!: Date;

  updatedAt!: Date;
}

export const PostCommentSchema = SchemaFactory.createForClass(PostComment);
