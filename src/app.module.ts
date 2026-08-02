import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuditLogsModule } from './domains/audit-logs/audit-logs.module';
import { CampaignsModule } from './domains/campaigns/campaigns.module';
import { CategoriesModule } from './domains/categories/categories.module';
import { ConversationsModule } from './domains/conversations/conversations.module';
import { DeliveryProofsModule } from './domains/delivery-proofs/delivery-proofs.module';
import { DonationStatusHistoryModule } from './domains/donation-status-history/donation-status-history.module';
import { DonationsModule } from './domains/donations/donations.module';
import { ErrorLogsModule } from './domains/error-logs/error-logs.module';
import { FollowsModule } from './domains/follows/follows.module';
import { InstitutionStaffMembershipsModule } from './domains/institution-staff-memberships/institution-staff-memberships.module';
import { InstitutionsModule } from './domains/institutions/institutions.module';
import { MessagesModule } from './domains/messages/messages.module';
import { NotificationsModule } from './domains/notifications/notifications.module';
import { PaymentsModule } from './domains/payments/payments.module';
import { PostCommentsModule } from './domains/post-comments/post-comments.module';
import { PostReactionsModule } from './domains/post-reactions/post-reactions.module';
import { PostsModule } from './domains/posts/posts.module';
import { ReportsModule } from './domains/reports/reports.module';
import { TaxReceiptsModule } from './domains/tax-receipts/tax-receipts.module';
import { TrackingEventsModule } from './domains/tracking-events/tracking-events.module';
import { UsersModule } from './domains/users/users.module';
import { env } from './config/env';

@Module({
  imports: [
    MongooseModule.forRoot(env.mongodbUri),
    AuthModule,
    UsersModule,
    AuditLogsModule,
    InstitutionsModule,
    InstitutionStaffMembershipsModule,
    CampaignsModule,
    CategoriesModule,
    ConversationsModule,
    DeliveryProofsModule,
    DonationsModule,
    ErrorLogsModule,
    DonationStatusHistoryModule,
    FollowsModule,
    MessagesModule,
    NotificationsModule,
    PaymentsModule,
    PostCommentsModule,
    PostReactionsModule,
    PostsModule,
    ReportsModule,
    TaxReceiptsModule,
    TrackingEventsModule,
  ],
  controllers: [AppController],
  providers: [AppService, AllExceptionsFilter],
})
export class AppModule {}
