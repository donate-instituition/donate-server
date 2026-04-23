import { Types } from 'mongoose';

import { ReportReason, ReportStatus, ReportTargetType } from '../models';

export class UpdateReportDto {
  reporterUserId?: Types.ObjectId;

  targetType?: ReportTargetType;

  targetId?: Types.ObjectId;

  reason?: ReportReason;

  description?: string;

  status?: ReportStatus;

  reviewedByUserId?: Types.ObjectId;

  reviewedAt?: Date;
}
