import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import {
  InstitutionStaffMembershipRole,
  InstitutionStaffMembershipStatus,
} from '../models';

export type InstitutionStaffMembershipDocument =
  HydratedDocument<InstitutionStaffMembership>;

@Schema({
  collection: 'institution_staff_memberships',
  timestamps: true,
  versionKey: false,
})
export class InstitutionStaffMembership {
  _id!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Institution' })
  institutionId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({
    required: true,
    enum: InstitutionStaffMembershipRole,
    type: String,
  })
  role!: InstitutionStaffMembershipRole;

  @Prop({
    type: [String],
    default: [],
  })
  permissions!: string[];

  @Prop({
    required: true,
    enum: InstitutionStaffMembershipStatus,
    type: String,
    default: InstitutionStaffMembershipStatus.INVITED,
  })
  status!: InstitutionStaffMembershipStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  invitedByUserId?: Types.ObjectId;

  createdAt!: Date;

  updatedAt!: Date;
}

export const InstitutionStaffMembershipSchema = SchemaFactory.createForClass(
  InstitutionStaffMembership,
);
