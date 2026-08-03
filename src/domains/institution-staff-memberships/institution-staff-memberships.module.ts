import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { User, UserSchema } from '../users/schemas/user.schema';
import { Institution, InstitutionSchema } from '../institutions/schemas/institution.schema';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EmailJobsModule } from '../../notifications/email/email-jobs.module';
import {
  InstitutionStaffMembership,
  InstitutionStaffMembershipSchema,
} from './schemas/institution-staff-membership.schema';
import { InstitutionStaffMembershipsController } from './institution-staff-memberships.controller';
import { InstitutionStaffMembershipsService } from './institution-staff-memberships.service';

@Module({
  imports: [
    EmailJobsModule,
    AuditLogsModule,
    MongooseModule.forFeature([
      {
        name: InstitutionStaffMembership.name,
        schema: InstitutionStaffMembershipSchema,
      },
      { name: User.name, schema: UserSchema },
      { name: Institution.name, schema: InstitutionSchema },
    ]),
  ],
  controllers: [InstitutionStaffMembershipsController],
  providers: [InstitutionStaffMembershipsService],
})
export class InstitutionStaffMembershipsModule {}
