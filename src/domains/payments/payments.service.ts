import { Injectable } from '@nestjs/common';

import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Injectable()
export class PaymentsService {
  create(createPaymentDto: CreatePaymentDto) {
    return createPaymentDto;
  }

  findAll() {
    return [];
  }

  findOne(id: string) {
    return { id };
  }

  update(id: string, updatePaymentDto: UpdatePaymentDto) {
    return {
      id,
      ...updatePaymentDto,
    };
  }

  remove(id: string) {
    return { id };
  }
}
