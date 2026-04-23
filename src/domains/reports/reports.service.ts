import { Injectable } from '@nestjs/common';

import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';

@Injectable()
export class ReportsService {
  create(createReportDto: CreateReportDto) {
    return createReportDto;
  }

  findAll() {
    return [];
  }

  findOne(id: string) {
    return { id };
  }

  update(id: string, updateReportDto: UpdateReportDto) {
    return {
      id,
      ...updateReportDto,
    };
  }

  remove(id: string) {
    return { id };
  }
}
