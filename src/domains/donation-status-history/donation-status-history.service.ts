import { Injectable } from '@nestjs/common';

import { CreateDonationStatusHistoryDto } from './dto/create-donation-status-history.dto';
import { UpdateDonationStatusHistoryDto } from './dto/update-donation-status-history.dto';

@Injectable()
export class DonationStatusHistoryService {
  create(createDonationStatusHistoryDto: CreateDonationStatusHistoryDto) {
    return createDonationStatusHistoryDto;
  }

  findAll() {
    return [];
  }

  findOne(id: string) {
    return { id };
  }

  update(
    id: string,
    updateDonationStatusHistoryDto: UpdateDonationStatusHistoryDto,
  ) {
    return {
      id,
      ...updateDonationStatusHistoryDto,
    };
  }

  remove(id: string) {
    return { id };
  }
}
