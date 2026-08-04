import { Module } from '@nestjs/common';

import { QueueModule } from '../../queues/queue.module';
import { AppSettingsModule } from '../../domains/app-settings/app-settings.module';
import { EmailJobsService } from './email-jobs.service';

@Module({
  imports: [QueueModule, AppSettingsModule],
  providers: [EmailJobsService],
  exports: [EmailJobsService],
})
export class EmailJobsModule {}
