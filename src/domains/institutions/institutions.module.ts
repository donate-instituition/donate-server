import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Institution, InstitutionSchema } from './schemas/institution.schema';
import { InstitutionsController } from './institutions.controller';
import { InstitutionsService } from './institutions.service';
import {
  AuditLog,
  AuditLogSchema,
} from '../audit-logs/schemas/audit-log.schema';
import { Campaign, CampaignSchema } from '../campaigns/schemas/campaign.schema';
import {
  InstitutionStaffMembership,
  InstitutionStaffMembershipSchema,
} from '../institution-staff-memberships/schemas/institution-staff-membership.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Institution.name, schema: InstitutionSchema },
      { name: Campaign.name, schema: CampaignSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
      {
        name: InstitutionStaffMembership.name,
        schema: InstitutionStaffMembershipSchema,
      },
    ]),
  ],
  controllers: [InstitutionsController],
  providers: [InstitutionsService],
})
export class InstitutionsModule {}
