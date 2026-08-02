import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ErrorLog, ErrorLogDocument } from './schemas/error-log.schema';

export type CreateErrorLogDto = Omit<Partial<ErrorLog>, '_id' | 'createdAt'> & {
  requestId: string;
  serviceName: string;
  serviceVersion: string;
  statusCode: number;
  errorName: string;
  message: string;
  httpMethod: string;
  path: string;
};

@Injectable()
export class ErrorLogsService {
  private readonly logger = new Logger(ErrorLogsService.name);

  constructor(
    @InjectModel(ErrorLog.name)
    private readonly errorLogModel: Model<ErrorLogDocument>,
  ) {}

  async create(createErrorLogDto: CreateErrorLogDto) {
    try {
      return await this.errorLogModel.create(createErrorLogDto);
    } catch (error) {
      this.logger.error('Failed to persist error log', error instanceof Error ? error.stack : String(error));
      return null;
    }
  }
}
