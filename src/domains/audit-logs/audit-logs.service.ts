import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  getPaginationOptions,
  paginatedResponse,
  type PaginationQuery,
  shouldPaginate,
} from '../../common/pagination';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { UpdateAuditLogDto } from './dto/update-audit-log.dto';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

type AuditLogCategory = 'all' | 'institutions' | 'login' | 'users';
type AuditLogsQuery = PaginationQuery & {
  category?: AuditLogCategory;
};

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  private toAuditLogResponse(auditLog: AuditLogDocument | any) {
    return {
      id: auditLog._id?.toString() ?? auditLog.id,
      actorUserId: auditLog.actorUserId?.toString(),
      action: auditLog.action,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId?.toString(),
      metadata: auditLog.metadata,
      ip: auditLog.ip,
      userAgent: auditLog.userAgent,
      createdAt: auditLog.createdAt?.toISOString?.() ?? auditLog.createdAt,
    };
  }

  async create(createAuditLogDto: CreateAuditLogDto) {
    const auditLog = await this.auditLogModel.create(createAuditLogDto);
    return this.toAuditLogResponse(auditLog);
  }

  async findAll(query: AuditLogsQuery = {}) {
    const pagination = getPaginationOptions({
      limit: query.limit ?? '100',
      page: query.page,
      paginated: query.paginated,
      search: query.search,
      sort: query.sort,
    });
    const shouldReturnPaginated = shouldPaginate(query);
    const filter: Record<string, unknown> = {};
    const category = query.category ?? 'all';

    if (category === 'login') {
      filter.action = { $regex: '^auth\\.', $options: 'i' };
    }

    if (category === 'institutions') {
      filter.$or = [
        { action: { $regex: '^institution\\.', $options: 'i' } },
        { targetType: { $regex: '^institution$', $options: 'i' } },
      ];
    }

    if (category === 'users') {
      filter.$or = [
        { action: { $regex: '^user\\.', $options: 'i' } },
        { targetType: { $regex: '^user$', $options: 'i' } },
      ];
    }

    if (pagination.search) {
      const searchFilter = [
        { action: { $regex: pagination.search, $options: 'i' } },
        { targetType: { $regex: pagination.search, $options: 'i' } },
        { userAgent: { $regex: pagination.search, $options: 'i' } },
      ];

      filter.$and = filter.$or
        ? [{ $or: filter.$or }, { $or: searchFilter }]
        : [{ $or: searchFilter }];
      delete filter.$or;
    }

    const auditLogs = await this.auditLogModel
      .find(filter)
      .sort({ createdAt: pagination.sort === 'oldest' ? 1 : -1 })
      .skip(shouldReturnPaginated ? pagination.skip : 0)
      .limit(shouldReturnPaginated ? pagination.limit : 100)
      .lean()
      .exec();
    const items = auditLogs.map((auditLog) => this.toAuditLogResponse(auditLog));

    if (!shouldReturnPaginated) {
      return items;
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [total, todayCount] = await Promise.all([
      this.auditLogModel.countDocuments(filter).exec(),
      this.auditLogModel.countDocuments({ createdAt: { $gte: startOfToday } }).exec(),
    ]);

    return {
      ...paginatedResponse(items, total, pagination),
      summary: {
        todayCount,
      },
    };
  }

  async findOne(id: string) {
    const auditLog = await this.auditLogModel.findById(id).lean().exec();
    return auditLog ? this.toAuditLogResponse(auditLog) : null;
  }

  async update(id: string, updateAuditLogDto: UpdateAuditLogDto) {
    const auditLog = await this.auditLogModel
      .findByIdAndUpdate(id, updateAuditLogDto, { returnDocument: 'after' })
      .lean()
      .exec();
    return auditLog ? this.toAuditLogResponse(auditLog) : null;
  }

  async remove(id: string) {
    await this.auditLogModel.findByIdAndDelete(id).exec();
    return { id };
  }
}
