import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export enum IdempotencyRecordStatus {
  Completed = 'COMPLETED',
  InProgress = 'IN_PROGRESS',
}

export type IdempotencyRecordDocument = HydratedDocument<IdempotencyRecord>;

@Schema({
  collection: 'idempotency_records',
  timestamps: true,
  versionKey: false,
})
export class IdempotencyRecord {
  _id!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  scope!: string;

  @Prop({ required: true, trim: true })
  method!: string;

  @Prop({ required: true, trim: true })
  path!: string;

  @Prop({ required: true, trim: true })
  idempotencyKey!: string;

  @Prop({ required: true, trim: true })
  fingerprint!: string;

  @Prop({
    default: IdempotencyRecordStatus.InProgress,
    enum: IdempotencyRecordStatus,
    required: true,
    type: String,
  })
  status!: IdempotencyRecordStatus;

  @Prop()
  responseStatusCode?: number;

  @Prop({
    type: MongooseSchema.Types.Mixed,
  })
  responseBody?: unknown;

  @Prop({ trim: true })
  responseType?: 'json' | 'send';

  @Prop({ required: true })
  expiresAt!: Date;

  createdAt!: Date;

  updatedAt!: Date;
}

export const IdempotencyRecordSchema =
  SchemaFactory.createForClass(IdempotencyRecord);

IdempotencyRecordSchema.index(
  { scope: 1, method: 1, path: 1, idempotencyKey: 1 },
  { unique: true },
);
IdempotencyRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
