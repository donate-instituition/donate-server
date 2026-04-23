import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { DonationStatusHistoryController } from './donation-status-history.controller';
import { DonationStatusHistoryService } from './donation-status-history.service';
import {
  DonationStatusHistory,
  DonationStatusHistorySchema,
} from './schemas/donation-status-history.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: DonationStatusHistory.name,
        schema: DonationStatusHistorySchema,
      },
    ]),
  ],
  controllers: [DonationStatusHistoryController],
  providers: [DonationStatusHistoryService],
})
export class DonationStatusHistoryModule {}
