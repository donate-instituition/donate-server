import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { CreateTaxReceiptDto } from './dto/create-tax-receipt.dto';
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
