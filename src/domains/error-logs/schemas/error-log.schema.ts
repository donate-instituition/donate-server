import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ErrorLogDocument = HydratedDocument<ErrorLog>;

@Schema({
  collection: 'error_logs',
  timestamps: {
    createdAt: true,
    updatedAt: false,
  },
  versionKey: false,
})
export class ErrorLog {
  _id!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  requestId!: string;

  @Prop({ required: true, trim: true })
  serviceName!: string;

  @Prop({ required: true, trim: true })
  serviceVersion!: string;

  @Prop({ required: true })
  statusCode!: number;

  @Prop({ required: true, trim: true })
  errorName!: string;

  @Prop({ trim: true })
  errorCode?: string;

  @Prop({ required: true, trim: true })
  message!: string;

  @Prop({ required: true, trim: true })
  httpMethod!: string;

  @Prop({ required: true, trim: true })
  path!: string;

  @Prop({ trim: true })
  controllerMethod?: string;

  @Prop({ trim: true })
  sourceFile?: string;

  @Prop()
  sourceLine?: number;

  @Prop()
  sourceColumn?: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ trim: true })
  ip?: string;

  @Prop({ trim: true })
  userAgent?: string;

  @Prop({
    type: raw({
      params: { type: MongooseSchema.Types.Mixed },
      query: { type: MongooseSchema.Types.Mixed },
      body: { type: MongooseSchema.Types.Mixed },
    }),
  })
  request?: {
    params?: Record<string, unknown>;
    query?: Record<string, unknown>;
    body?: Record<string, unknown>;
  };

  @Prop({ type: [String], default: [] })
  stack?: string[];

  @Prop({
    type: raw({
      queued: {
        type: Boolean,
        default: false,
      },
      topic: {
        type: String,
      },
      queuedAt: {
        type: Date,
      },
    }),
    default: {
      queued: false,
    },
  })
  kafka?: {
    queued: boolean;
    topic?: string;
    queuedAt?: Date;
  };

  createdAt!: Date;
}

export const ErrorLogSchema = SchemaFactory.createForClass(ErrorLog);

ErrorLogSchema.index({ requestId: 1 }, { unique: true });
ErrorLogSchema.index({ createdAt: -1 });
ErrorLogSchema.index({ statusCode: 1, createdAt: -1 });
