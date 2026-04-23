import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

import { CreateTrackingEventDto } from './dto/create-tracking-event.dto';
import { UpdateTrackingEventDto } from './dto/update-tracking-event.dto';
import { TrackingEventsService } from './tracking-events.service';

@Controller('tracking-events')
export class TrackingEventsController {
  constructor(private readonly trackingEventsService: TrackingEventsService) {}

  @Post()
  create(@Body() createTrackingEventDto: CreateTrackingEventDto) {
    return this.trackingEventsService.create(createTrackingEventDto);
  }

  @Get()
  findAll() {
    return this.trackingEventsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.trackingEventsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateTrackingEventDto: UpdateTrackingEventDto,
  ) {
    return this.trackingEventsService.update(id, updateTrackingEventDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.trackingEventsService.remove(id);
  }
}
