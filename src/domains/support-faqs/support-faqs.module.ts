import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { SupportFaq, SupportFaqSchema } from './schemas/support-faq.schema';
import { SupportFaqsController } from './support-faqs.controller';
import { SupportFaqsService } from './support-faqs.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupportFaq.name, schema: SupportFaqSchema },
    ]),
  ],
  controllers: [SupportFaqsController],
  providers: [SupportFaqsService],
})
export class SupportFaqsModule {}
