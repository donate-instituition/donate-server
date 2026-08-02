import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { UpdateAuditLogDto } from './dto/update-audit-log.dto';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLogDocument>,
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

  async findAll() {
    const auditLogs = await this.auditLogModel.find().sort({ createdAt: -1 }).limit(100).lean().exec();
    return auditLogs.map((auditLog) => this.toAuditLogResponse(auditLog));
  }

  async findOne(id: string) {
    const auditLog = await this.auditLogModel.findById(id).lean().exec();
    return auditLog ? this.toAuditLogResponse(auditLog) : null;
  }

  async update(id: string, updateAuditLogDto: UpdateAuditLogDto) {
    const auditLog = await this.auditLogModel.findByIdAndUpdate(id, updateAuditLogDto, { new: true }).lean().exec();
    return auditLog ? this.toAuditLogResponse(auditLog) : null;
  }

  async remove(id: string) {
    await this.auditLogModel.findByIdAndDelete(id).exec();
    return { id };
  }
}
