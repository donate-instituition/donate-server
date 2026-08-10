import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { User, UserSchema } from '../../domains/users/schemas/user.schema';
import { FirebaseAdminService } from './firebase-admin.service';
import { PushNotificationsService } from './push-notifications.service';
import { PushNotificationsWorkerService } from './push-notifications-worker.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [
    FirebaseAdminService,
    PushNotificationsService,
    PushNotificationsWorkerService,
  ],
  exports: [PushNotificationsService],
})
export class PushNotificationsModule {}
