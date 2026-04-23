import { Injectable } from '@nestjs/common';

import { CreateDeliveryProofDto } from './dto/create-delivery-proof.dto';
import { UpdateDeliveryProofDto } from './dto/update-delivery-proof.dto';

@Injectable()
export class DeliveryProofsService {
  create(createDeliveryProofDto: CreateDeliveryProofDto) {
    return createDeliveryProofDto;
  }

  findAll() {
    return [];
  }

  findOne(id: string) {
    return { id };
  }

  update(id: string, updateDeliveryProofDto: UpdateDeliveryProofDto) {
    return {
      id,
      ...updateDeliveryProofDto,
    };
  }

  remove(id: string) {
    return { id };
  }
}
