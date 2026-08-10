import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { User, type UserDocument } from '../../domains/users/schemas/user.schema';
import { FirebaseAdminService } from './firebase-admin.service';

type SendPushNotificationInput = {
  body: string;
  data?: Record<string, unknown>;
  title: string;
  userId: string;
};

function toFcmData(data?: Record<string, unknown>) {
  return Object.entries(data ?? {}).reduce<Record<string, string>>(
    (payload, [key, value]) => {
      if (value === undefined || value === null) {
        return payload;
      }

      payload[key] =
        typeof value === 'string' ? value : JSON.stringify(value);
      return payload;
    },
    {},
  );
}

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly firebaseAdminService: FirebaseAdminService,
  ) {}

  async sendToUser(input: SendPushNotificationInput) {
    const user = await this.userModel
      .findById(new Types.ObjectId(input.userId))
      .select('settings pushTokens')
      .lean()
      .exec();

    if (!user?.settings?.notifications?.push) {
      this.logger.debug(
        JSON.stringify({
          event: 'push_skipped_user_disabled',
          userId: input.userId,
        }),
      );
      return;
    }

    const tokens = (user.pushTokens ?? [])
      .filter((pushToken) => !pushToken.disabledAt)
      .map((pushToken) => pushToken.token);

    if (!tokens.length) {
      this.logger.debug(
        JSON.stringify({
          event: 'push_skipped_no_tokens',
          userId: input.userId,
        }),
      );
      return;
    }

    await Promise.all(
      tokens.map(async (token) => {
        try {
          const messageId = await this.firebaseAdminService.send({
            token,
            notification: {
              body: input.body,
              title: input.title,
            },
            data: toFcmData(input.data),
            android: {
              priority: 'high',
              notification: {
                channelId: 'default',
              },
            },
            apns: {
              payload: {
                aps: {
                  sound: 'default',
                },
              },
            },
          });

          this.logger.debug(
            JSON.stringify({
              event: 'push_sent',
              messageId,
              userId: input.userId,
            }),
          );
        } catch (error) {
          this.logger.warn(
            JSON.stringify({
              event: 'push_failed',
              message: error instanceof Error ? error.message : String(error),
              userId: input.userId,
            }),
          );
        }
      }),
    );
  }
}
