import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StripeWebhookEventDocument = HydratedDocument<StripeWebhookEvent>;

export enum StripeWebhookEventStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

@Schema({
  collection: 'stripe_webhook_events',
  timestamps: true,
  versionKey: false,
})
export class StripeWebhookEvent {
  @Prop({ required: true, trim: true })
  eventId!: string;

  @Prop({ required: true, trim: true })
  type!: string;

  @Prop({
    required: true,
    enum: StripeWebhookEventStatus,
    type: String,
    default: StripeWebhookEventStatus.QUEUED,
  })
  status!: StripeWebhookEventStatus;

  @Prop({ type: Object, required: true })
  payload!: Record<string, unknown>;

  @Prop({ required: true, default: false })
  livemode!: boolean;

  @Prop({ trim: true })
  lastError?: string;

  @Prop()
  processedAt?: Date;

  createdAt!: Date;

  updatedAt!: Date;
}

export const StripeWebhookEventSchema =
  SchemaFactory.createForClass(StripeWebhookEvent);
StripeWebhookEventSchema.index({ eventId: 1 }, { unique: true });
