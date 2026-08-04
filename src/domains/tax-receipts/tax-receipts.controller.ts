import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { isAbsolute } from 'path';

import { CreateTaxReceiptDto } from './dto/create-tax-receipt.dto';
import { Public } from '../../auth/decorators/public.decorator';
import { UpdateTaxReceiptDto } from './dto/update-tax-receipt.dto';
import { TaxReceiptsService } from './tax-receipts.service';

@Controller('tax-receipts')
export class TaxReceiptsController {
  constructor(private readonly taxReceiptsService: TaxReceiptsService) {}

  @Post()
  create(@Body() createTaxReceiptDto: CreateTaxReceiptDto) {
    return this.taxReceiptsService.create(createTaxReceiptDto);
  }

  @Get()
  findAll() {
    return this.taxReceiptsService.findAll();
  }

  @Get(':id/pdf')
  @Public()
  async getPdf(
    @Param('id') id: string,
    @Query('token') token: string | undefined,
    @Res() response: Response,
  ) {
    const downloadUrl = await this.taxReceiptsService.getPdfDownloadUrl(id, token);
    if (isAbsolute(downloadUrl)) {
      return response.sendFile(downloadUrl);
    }

    return response.redirect(downloadUrl);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.taxReceiptsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateTaxReceiptDto: UpdateTaxReceiptDto,
  ) {
    return this.taxReceiptsService.update(id, updateTaxReceiptDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.taxReceiptsService.remove(id);
  }
}
