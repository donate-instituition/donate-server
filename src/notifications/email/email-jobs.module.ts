import { Module } from '@nestjs/common';

import { QueueModule } from '../../queues/queue.module';
import { EmailJobsService } from './email-jobs.service';

@Module({
  imports: [QueueModule],
  providers: [EmailJobsService],
  exports: [EmailJobsService],
})
export class EmailJobsModule {}
