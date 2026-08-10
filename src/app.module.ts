import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { IdempotencyMiddleware } from './common/idempotency/middleware/idempotency.middleware';
import {
  IdempotencyRecord,
  IdempotencyRecordSchema,
} from './common/idempotency/schemas/idempotency-record.schema';
import { RequestLoggingMiddleware } from './common/logger';
import { createRateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { env } from './config/env';
import { AuditLogsModule } from './domains/audit-logs/audit-logs.module';
import { AppSettingsModule } from './domains/app-settings/app-settings.module';
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
import { SupportFaqsModule } from './domains/support-faqs/support-faqs.module';
import { TaxReceiptsModule } from './domains/tax-receipts/tax-receipts.module';
import { TermsModule } from './domains/terms/terms.module';
import { TrackingEventsModule } from './domains/tracking-events/tracking-events.module';
import { UsersModule } from './domains/users/users.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    MongooseModule.forRoot(env.mongodbUri),
    MongooseModule.forFeature([
      { name: IdempotencyRecord.name, schema: IdempotencyRecordSchema },
    ]),
    StorageModule,
    AppSettingsModule,
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
    SupportFaqsModule,
    TaxReceiptsModule,
    TermsModule,
    TrackingEventsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AllExceptionsFilter,
    IdempotencyMiddleware,
    RequestLoggingMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestLoggingMiddleware, IdempotencyMiddleware)
      .forRoutes('*');

    consumer
      .apply(
        createRateLimitMiddleware({
          name: 'auth',
          windowMs: env.authRateLimitWindowMs,
          maxRequests: env.authRateLimitMaxRequests,
          skipSuccessfulOptions: true,
        }),
      )
      .forRoutes(
        'auth/login',
        'auth/register',
        'auth/activate-account',
        'auth/resend-activation',
        'auth/forgot-password',
        'auth/refresh',
      );

    consumer
      .apply(
        createRateLimitMiddleware({
          name: 'global',
          windowMs: env.rateLimitWindowMs,
          maxRequests: env.rateLimitMaxRequests,
          scope: 'client',
          skipSuccessfulOptions: true,
        }),
      )
      .forRoutes('*');
  }
}
