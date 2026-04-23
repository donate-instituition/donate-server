import { Injectable } from '@nestjs/common';

import { CreateTrackingEventDto } from './dto/create-tracking-event.dto';
import { UpdateTrackingEventDto } from './dto/update-tracking-event.dto';

@Injectable()
export class TrackingEventsService {
  create(createTrackingEventDto: CreateTrackingEventDto) {
    return createTrackingEventDto;
  }

  findAll() {
    return [];
  }

  findOne(id: string) {
    return { id };
  }

  update(id: string, updateTrackingEventDto: UpdateTrackingEventDto) {
    return {
      id,
      ...updateTrackingEventDto,
    };
  }

  remove(id: string) {
    return { id };
  }
}
