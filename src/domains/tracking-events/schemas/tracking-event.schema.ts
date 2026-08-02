import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { TrackingEventType } from '../models';
import type { TrackingEventLocation } from '../models';

export type TrackingEventDocument = HydratedDocument<TrackingEvent>;

@Schema({
  collection: 'tracking_events',
  timestamps: {
    createdAt: true,
    updatedAt: false,
  },
  versionKey: false,
})
export class TrackingEvent {
  _id!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Donation' })
  donationId!: Types.ObjectId;

  @Prop({
    required: true,
    enum: TrackingEventType,
    type: String,
  })
  eventType!: TrackingEventType;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    default: {
      type: 'Point',
      coordinates: [],
    },
  })
  location?: TrackingEventLocation;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  actorUserId?: Types.ObjectId;

  @Prop({ trim: true })
  photoUrl?: string;

  createdAt!: Date;
}

export const TrackingEventSchema = SchemaFactory.createForClass(TrackingEvent);
