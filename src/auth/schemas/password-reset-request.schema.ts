import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum PasswordResetRequestStatus {
  Pending = 'PENDING',
  Used = 'USED',
}

export type PasswordResetRequestDocument =
  HydratedDocument<PasswordResetRequest>;

@Schema({
  collection: 'password_reset_requests',
  timestamps: true,
  versionKey: false,
})
export class PasswordResetRequest {
  _id!: Types.ObjectId;

  @Prop({ required: true, trim: true, lowercase: true })
  email!: string;

  @Prop({ required: true, trim: true })
  codeHash!: string;

  @Prop({
    default: PasswordResetRequestStatus.Pending,
    enum: PasswordResetRequestStatus,
    required: true,
    type: String,
  })
  status!: PasswordResetRequestStatus;

  @Prop({ default: 0, required: true })
  attempts!: number;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop()
  usedAt?: Date;

  createdAt!: Date;

  updatedAt!: Date;
}

export const PasswordResetRequestSchema =
  SchemaFactory.createForClass(PasswordResetRequest);

PasswordResetRequestSchema.index({ email: 1, createdAt: -1 });
PasswordResetRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
