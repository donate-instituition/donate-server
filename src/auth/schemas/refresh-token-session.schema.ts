import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RefreshTokenSessionDocument = HydratedDocument<RefreshTokenSession>;

@Schema({
  collection: 'refresh_token_sessions',
  timestamps: true,
  versionKey: false,
})
export class RefreshTokenSession {
  _id!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true, trim: true })
  refreshTokenHash!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop()
  revokedAt?: Date;

  @Prop()
  replacedByTokenHash?: string;

  createdAt!: Date;

  updatedAt!: Date;
}

export const RefreshTokenSessionSchema = SchemaFactory.createForClass(RefreshTokenSession);
