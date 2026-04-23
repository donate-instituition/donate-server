import { Injectable } from '@nestjs/common';

import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@Injectable()
export class CampaignsService {
  create(createCampaignDto: CreateCampaignDto) {
    return createCampaignDto;
  }

  findAll() {
    return [];
  }

  findOne(id: string) {
    return { id };
  }

  update(id: string, updateCampaignDto: UpdateCampaignDto) {
    return {
      id,
      ...updateCampaignDto,
    };
  }

  remove(id: string) {
    return { id };
  }
}
