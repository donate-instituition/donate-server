import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  DeliveryProof,
  DeliveryProofSchema,
} from './schemas/delivery-proof.schema';
import { Campaign, CampaignSchema } from '../campaigns/schemas/campaign.schema';
import {
  InstitutionStaffMembership,
  InstitutionStaffMembershipSchema,
} from '../institution-staff-memberships/schemas/institution-staff-membership.schema';
import { DeliveryProofsController } from './delivery-proofs.controller';
import { DeliveryProofsService } from './delivery-proofs.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DeliveryProof.name, schema: DeliveryProofSchema },
      { name: Campaign.name, schema: CampaignSchema },
      {
        name: InstitutionStaffMembership.name,
        schema: InstitutionStaffMembershipSchema,
      },
    ]),
  ],
  controllers: [DeliveryProofsController],
  providers: [DeliveryProofsService],
})
export class DeliveryProofsModule {}
