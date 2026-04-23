import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { ReportReason, ReportStatus, ReportTargetType } from '../models';

export type ReportDocument = HydratedDocument<Report>;

@Schema({
  collection: 'reports',
  timestamps: true,
  versionKey: false,
})
export class Report {
  _id!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  reporterUserId!: Types.ObjectId;

  @Prop({
    required: true,
    enum: ReportTargetType,
    type: String,
  })
  targetType!: ReportTargetType;

  @Prop({ required: true, type: Types.ObjectId })
  targetId!: Types.ObjectId;

  @Prop({
    required: true,
    enum: ReportReason,
    type: String,
  })
  reason!: ReportReason;

  @Prop({ trim: true })
  description?: string;

  @Prop({
    required: true,
    enum: ReportStatus,
    type: String,
    default: ReportStatus.OPEN,
  })
  status!: ReportStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedByUserId?: Types.ObjectId;

  @Prop()
  reviewedAt?: Date;

  createdAt!: Date;

  updatedAt!: Date;
}

export const ReportSchema = SchemaFactory.createForClass(Report);
