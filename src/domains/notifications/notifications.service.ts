import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { createQueueMessage } from '../../queues/queue-message';
import { RabbitMqPublisherService } from '../../queues/rabbitmq-publisher.service';

import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import {
  Notification,
  type NotificationDocument,
} from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    private readonly rabbitMqPublisherService: RabbitMqPublisherService,
  ) {}

  async create(createNotificationDto: CreateNotificationDto) {
    const notification = await this.notificationModel.create(
      createNotificationDto,
    );
    await this.publishPushJob(notification);

    return this.serialize(notification);
  }

  async createOnceByDataField(
    field: string,
    value: string,
    createNotificationDto: CreateNotificationDto,
  ) {
    const existingNotification = await this.notificationModel
      .findOne({ [`data.${field}`]: value })
      .exec();

    if (existingNotification) {
      return this.serialize(existingNotification);
    }

    const notification = await this.notificationModel.create(
      createNotificationDto,
    );
    await this.publishPushJob(notification);

    return this.serialize(notification);
  }

  private async publishPushJob(notification: NotificationDocument) {
    await this.rabbitMqPublisherService.publish(
      'notification.push',
      createQueueMessage({
        type: 'notification.push',
        payload: {
          body: notification.body,
          data: {
            ...(notification.data ?? {}),
            notificationId: notification._id.toString(),
            type: notification.type,
          },
          notificationId: notification._id.toString(),
          title: notification.title,
          userId: notification.userId.toString(),
        },
      }),
    );
  }

  async findMine(currentUser?: AuthenticatedUser) {
    if (!currentUser?.sub) return [];

    const notifications = await this.notificationModel
      .find({ userId: new Types.ObjectId(currentUser.sub) })
      .sort({ createdAt: -1 })
      .limit(80)
      .exec();

    return notifications.map((notification) => this.serialize(notification));
  }

  async findAll() {
    const notifications = await this.notificationModel
      .find()
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();

    return notifications.map((notification) => this.serialize(notification));
  }

  async findOne(id: string) {
    const notification = await this.notificationModel.findById(id).exec();
    if (!notification) throw new NotFoundException('Notification not found');
    return this.serialize(notification);
  }

  async markAsRead(id: string, currentUser?: AuthenticatedUser) {
    const query = currentUser?.sub
      ? { _id: id, userId: new Types.ObjectId(currentUser.sub) }
      : { _id: id };
    const notification = await this.notificationModel
      .findOneAndUpdate(
        query,
        { $set: { readAt: new Date() } },
        { returnDocument: 'after' },
      )
      .exec();

    if (!notification) throw new NotFoundException('Notification not found');
    return this.serialize(notification);
  }

  async update(id: string, updateNotificationDto: UpdateNotificationDto) {
    const notification = await this.notificationModel
      .findByIdAndUpdate(id, updateNotificationDto, { returnDocument: 'after' })
      .exec();

    if (!notification) throw new NotFoundException('Notification not found');
    return this.serialize(notification);
  }

  async remove(id: string) {
    const notification = await this.notificationModel
      .findByIdAndDelete(id)
      .exec();
    if (!notification) throw new NotFoundException('Notification not found');
    return { id };
  }

  private serialize(notification: NotificationDocument) {
    return {
      id: notification._id.toString(),
      userId: notification.userId.toString(),
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      readAt: notification.readAt?.toISOString(),
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
