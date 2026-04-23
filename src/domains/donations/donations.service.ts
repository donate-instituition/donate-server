import { Injectable } from '@nestjs/common';

import { CreateDonationDto } from './dto/create-donation.dto';
import { UpdateDonationDto } from './dto/update-donation.dto';

@Injectable()
export class DonationsService {
  create(createDonationDto: CreateDonationDto) {
    return createDonationDto;
  }

  findAll() {
    return [];
  }

  findOne(id: string) {
    return { id };
  }

  update(id: string, updateDonationDto: UpdateDonationDto) {
    return {
      id,
      ...updateDonationDto,
    };
  }

  remove(id: string) {
    return { id };
  }
}
