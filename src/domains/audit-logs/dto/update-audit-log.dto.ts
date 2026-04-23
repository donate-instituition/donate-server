import { Types } from 'mongoose';

import type { AuditLogMetadata } from '../models';

export class UpdateAuditLogDto {
  actorUserId?: Types.ObjectId;

  action?: string;

  targetType?: string;

  targetId?: Types.ObjectId;

  metadata?: AuditLogMetadata;

  ip?: string;

  userAgent?: string;
}
