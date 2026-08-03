import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TermDocument = HydratedDocument<Term>;

@Schema({
  collection: 'terms',
  timestamps: true,
  versionKey: false,
})
export class Term {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, trim: true, unique: true })
  version!: string;

  @Prop({ required: true })
  content!: string;

  @Prop({ required: true, default: false })
  isCurrent!: boolean;

  @Prop()
  publishedAt?: Date;

  createdAt!: Date;

  updatedAt!: Date;
}

export const TermSchema = SchemaFactory.createForClass(Term);
TermSchema.index({ isCurrent: 1 });
