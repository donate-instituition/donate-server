import { Injectable } from '@nestjs/common';

import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';

@Injectable()
export class NotificationsService {
  create(createNotificationDto: CreateNotificationDto) {
    return createNotificationDto;
  }

  findAll() {
    return [];
  }

  findOne(id: string) {
    return { id };
  }

  update(id: string, updateNotificationDto: UpdateNotificationDto) {
    return {
      id,
      ...updateNotificationDto,
    };
  }

  remove(id: string) {
    return { id };
  }
}
