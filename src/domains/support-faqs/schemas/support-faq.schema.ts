import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SupportFaqDocument = HydratedDocument<SupportFaq>;

@Schema({ _id: false, versionKey: false })
export class SupportFaqItem {
  @Prop({ required: true, trim: true })
  question!: string;

  @Prop({ required: true, trim: true })
  answer!: string;

  @Prop({ required: true, default: 0 })
  order!: number;
}

export const SupportFaqItemSchema =
  SchemaFactory.createForClass(SupportFaqItem);

@Schema({
  collection: 'support_faqs',
  timestamps: true,
  versionKey: false,
})
export class SupportFaq {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, trim: true, unique: true })
  version!: string;

  @Prop({ type: [SupportFaqItemSchema], required: true, default: [] })
  items!: SupportFaqItem[];

  @Prop({ required: true, default: false })
  isCurrent!: boolean;

  @Prop()
  publishedAt?: Date;

  createdAt!: Date;

  updatedAt!: Date;
}

export const SupportFaqSchema = SchemaFactory.createForClass(SupportFaq);
SupportFaqSchema.index({ isCurrent: 1 });
