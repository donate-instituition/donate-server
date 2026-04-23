import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { TrackingEvent, TrackingEventSchema } from './schemas/tracking-event.schema';
import { TrackingEventsController } from './tracking-events.controller';
import { TrackingEventsService } from './tracking-events.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrackingEvent.name, schema: TrackingEventSchema },
    ]),
  ],
  controllers: [TrackingEventsController],
  providers: [TrackingEventsService],
})
export class TrackingEventsModule {}
