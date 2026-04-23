import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { NotificationType } from '../models';
import type { NotificationData } from '../models';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({
  collection: 'notifications',
  timestamps: {
    createdAt: true,
    updatedAt: false,
  },
  versionKey: false,
})
export class Notification {
  _id!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({
    required: true,
    enum: NotificationType,
    type: String,
  })
  type!: NotificationType;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, trim: true })
  body!: string;

  @Prop({
    type: MongooseSchema.Types.Mixed,
  })
  data?: NotificationData;

  @Prop()
  readAt?: Date;

  createdAt!: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
