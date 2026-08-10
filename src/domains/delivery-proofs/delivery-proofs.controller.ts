import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { isAbsolute } from 'path';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CreateDeliveryProofDto } from './dto/create-delivery-proof.dto';
import { UpdateDeliveryProofDto } from './dto/update-delivery-proof.dto';
import { UploadDeliveryProofAssetDto } from './dto/upload-delivery-proof-asset.dto';
import { DeliveryProofsService } from './delivery-proofs.service';

@Controller('delivery-proofs')
export class DeliveryProofsController {
  constructor(private readonly deliveryProofsService: DeliveryProofsService) {}

  @Post()
  create(
    @Body() createDeliveryProofDto: CreateDeliveryProofDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.deliveryProofsService.create(createDeliveryProofDto, user);
  }

  @Post('uploads')
  async uploadAsset(
    @Body() uploadDeliveryProofAssetDto: UploadDeliveryProofAssetDto,
    @Req() request: Request,
  ) {
    const uploadedAsset = await this.deliveryProofsService.uploadAsset(
      uploadDeliveryProofAssetDto,
    );

    return {
      ...uploadedAsset,
      url: `${request.protocol}://${request.get('host')}${uploadedAsset.url}`,
    };
  }

  @Get()
  findAll() {
    return this.deliveryProofsService.findAll();
  }

  @Get('uploads/:fileName')
  async getUploadedAsset(
    @Param('fileName') fileName: string,
    @Res() response: Response,
  ) {
    const downloadUrl =
      await this.deliveryProofsService.getUploadedAssetUrl(fileName);

    if (isAbsolute(downloadUrl)) {
      return response.sendFile(downloadUrl);
    }

    return response.redirect(downloadUrl);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.deliveryProofsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDeliveryProofDto: UpdateDeliveryProofDto,
  ) {
    return this.deliveryProofsService.update(id, updateDeliveryProofDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.deliveryProofsService.remove(id);
  }
}
