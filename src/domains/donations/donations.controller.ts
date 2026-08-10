import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CreateDonationDto } from './dto/create-donation.dto';
import { UpdateDonationDto } from './dto/update-donation.dto';
import { DonationsService } from './donations.service';

@Controller('donations')
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @Post()
  create(
    @Body() createDonationDto: CreateDonationDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.donationsService.create(createDonationDto, user?.sub);
  }

  @Get('me')
  findMyDonations(@CurrentUser() user: AuthenticatedUser | undefined) {
    return this.donationsService.findMyDonations(user?.sub);
  }

  @Get('institution/me')
  findMyInstitutionDonations(
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.donationsService.findMyInstitutionDonations(user?.sub);
  }

  @Get()
  findAll() {
    return this.donationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.donationsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDonationDto: UpdateDonationDto,
  ) {
    return this.donationsService.update(id, updateDonationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.donationsService.remove(id);
  }
}
