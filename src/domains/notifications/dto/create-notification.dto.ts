import { Types } from 'mongoose';

import { NotificationType } from '../models';
import type { NotificationData } from '../models';

export class CreateNotificationDto {
  userId!: Types.ObjectId;

  type!: NotificationType;

  title!: string;

  body!: string;

  data?: NotificationData;

  readAt?: Date;
}
