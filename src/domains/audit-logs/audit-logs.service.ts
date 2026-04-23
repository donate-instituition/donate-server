import { Injectable } from '@nestjs/common';

import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { UpdateAuditLogDto } from './dto/update-audit-log.dto';

@Injectable()
export class AuditLogsService {
  create(createAuditLogDto: CreateAuditLogDto) {
    return createAuditLogDto;
  }

  findAll() {
    return [];
  }

  findOne(id: string) {
    return { id };
  }

  update(id: string, updateAuditLogDto: UpdateAuditLogDto) {
    return {
      id,
      ...updateAuditLogDto,
    };
  }

  remove(id: string) {
    return { id };
  }
}
