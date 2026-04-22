import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { UserRole } from '../models';

export type UserDocument = HydratedDocument<User>;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class User {
  _id!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  })
  email!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true })
  cpf?: string;

  @Prop({
    required: true,
    enum: UserRole,
    type: String,
  })
  role!: UserRole;

  @Prop({ trim: true })
  profileImageUrl?: string;

  @Prop({ required: true, default: true })
  isActive!: boolean;

  createdAt!: Date;

  updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
