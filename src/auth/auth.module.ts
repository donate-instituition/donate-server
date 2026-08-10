import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';

import {
  InstitutionStaffMembership,
  InstitutionStaffMembershipSchema,
} from '../domains/institution-staff-memberships/schemas/institution-staff-membership.schema';
import {
  Institution,
  InstitutionSchema,
} from '../domains/institutions/schemas/institution.schema';
import { AuditLogsModule } from '../domains/audit-logs/audit-logs.module';
import { UsersModule } from '../domains/users/users.module';
import { EmailJobsModule } from '../notifications/email/email-jobs.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import {
  RefreshTokenSession,
  RefreshTokenSessionSchema,
} from './schemas/refresh-token-session.schema';

@Module({
  imports: [
    UsersModule,
    EmailJobsModule,
    AuditLogsModule,
    MongooseModule.forFeature([
      { name: RefreshTokenSession.name, schema: RefreshTokenSessionSchema },
      { name: Institution.name, schema: InstitutionSchema },
      {
        name: InstitutionStaffMembership.name,
        schema: InstitutionStaffMembershipSchema,
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
