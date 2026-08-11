import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { isAbsolute } from 'path';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { CreateUploadDto } from './dto/create-upload.dto';
import { UploadsService } from './uploads.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  createUpload(@Body() createUploadDto: CreateUploadDto) {
    return this.uploadsService.createUpload(createUploadDto);
  }

  @Post(':uploadId/confirm')
  async confirmUpload(
    @Param('uploadId') uploadId: string,
    @Body() confirmUploadDto: ConfirmUploadDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const confirmedUpload = await this.uploadsService.confirmUpload(
      uploadId,
      confirmUploadDto,
      user,
    );

    if (!confirmedUpload.url) {
      return confirmedUpload;
    }

    return {
      ...confirmedUpload,
      url: `${request.protocol}://${request.get('host')}${confirmedUpload.url}`,
    };
  }

  @Public()
  @Get('public')
  async getPublicObject(@Query('key') key: string, @Res() response: Response) {
    const downloadUrl = await this.uploadsService.getPublicDownloadUrl(key);

    if (isAbsolute(downloadUrl)) {
      return response.sendFile(downloadUrl);
    }

    return response.redirect(downloadUrl);
  }

  @Get('private')
  async getPrivateObject(
    @Query('key') key: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const downloadUrl = await this.uploadsService.getPrivateDownloadUrl(
      key,
      user,
    );

    if (isAbsolute(downloadUrl)) {
      return response.sendFile(downloadUrl);
    }

    return response.redirect(downloadUrl);
  }
}
