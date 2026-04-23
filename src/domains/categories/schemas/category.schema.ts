import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { CategoryType } from '../models';

export type CategoryDocument = HydratedDocument<Category>;

@Schema({
  collection: 'categories',
  timestamps: {
    createdAt: true,
    updatedAt: false,
  },
  versionKey: false,
})
export class Category {
  _id!: Types.ObjectId;

  @Prop({
    required: true,
    enum: CategoryType,
    type: String,
  })
  type!: CategoryType;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true, lowercase: true })
  slug!: string;

  @Prop({ required: true, default: true })
  isActive!: boolean;

  createdAt!: Date;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
