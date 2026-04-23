import { Injectable } from '@nestjs/common';

import { CreateTaxReceiptDto } from './dto/create-tax-receipt.dto';
import { UpdateTaxReceiptDto } from './dto/update-tax-receipt.dto';

@Injectable()
export class TaxReceiptsService {
  create(createTaxReceiptDto: CreateTaxReceiptDto) {
    return createTaxReceiptDto;
  }

  findAll() {
    return [];
  }

  findOne(id: string) {
    return { id };
  }

  update(id: string, updateTaxReceiptDto: UpdateTaxReceiptDto) {
    return {
      id,
      ...updateTaxReceiptDto,
    };
  }

  remove(id: string) {
    return { id };
  }
}
