import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { CreateDonationStatusHistoryDto } from './dto/create-donation-status-history.dto';
import { UpdateDonationStatusHistoryDto } from './dto/update-donation-status-history.dto';
import { DonationStatusHistoryService } from './donation-status-history.service';

@Controller('donation-status-history')
export class DonationStatusHistoryController {
  constructor(
    private readonly donationStatusHistoryService: DonationStatusHistoryService,
  ) {}

  @Post()
  create(
    @Body() createDonationStatusHistoryDto: CreateDonationStatusHistoryDto,
  ) {
    return this.donationStatusHistoryService.create(
      createDonationStatusHistoryDto,
    );
  }

  @Get()
  findAll() {
    return this.donationStatusHistoryService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.donationStatusHistoryService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDonationStatusHistoryDto: UpdateDonationStatusHistoryDto,
  ) {
    return this.donationStatusHistoryService.update(
      id,
      updateDonationStatusHistoryDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.donationStatusHistoryService.remove(id);
  }
}
