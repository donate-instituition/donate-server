import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  AuditLog,
  AuditLogSchema,
} from '../audit-logs/schemas/audit-log.schema';
import {
  Campaign,
  CampaignSchema,
} from '../campaigns/schemas/campaign.schema';
import {
  Donation,
  DonationSchema,
} from '../donations/schemas/donation.schema';
import {
  Institution,
  InstitutionSchema,
} from '../institutions/schemas/institution.schema';
import { Post, PostSchema } from '../posts/schemas/post.schema';
import { User, UserSchema } from './schemas/user.schema';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: Campaign.name, schema: CampaignSchema },
      { name: Donation.name, schema: DonationSchema },
      { name: Institution.name, schema: InstitutionSchema },
      { name: Post.name, schema: PostSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
