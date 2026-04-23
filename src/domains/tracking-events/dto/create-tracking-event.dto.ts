import { Types } from 'mongoose';

import { TrackingEventType } from '../models';
import type { TrackingEventLocation } from '../models';

export class CreateTrackingEventDto {
  donationId!: Types.ObjectId;

  eventType!: TrackingEventType;

  location?: TrackingEventLocation;

  description?: string;

  actorUserId?: Types.ObjectId;

  photoUrl?: string;
}
