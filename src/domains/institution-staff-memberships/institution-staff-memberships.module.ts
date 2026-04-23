import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  InstitutionStaffMembership,
  InstitutionStaffMembershipSchema,
} from './schemas/institution-staff-membership.schema';
import { InstitutionStaffMembershipsController } from './institution-staff-memberships.controller';
import { InstitutionStaffMembershipsService } from './institution-staff-memberships.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: InstitutionStaffMembership.name,
        schema: InstitutionStaffMembershipSchema,
      },
    ]),
  ],
  controllers: [InstitutionStaffMembershipsController],
  providers: [InstitutionStaffMembershipsService],
})
export class InstitutionStaffMembershipsModule {}
