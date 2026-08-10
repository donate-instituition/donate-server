import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import type { PaginationQuery } from '../../common/pagination';
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
  findMyDonations(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: PaginationQuery,
  ) {
    return this.donationsService.findMyDonations(user?.sub, query);
  }

  @Get('institution/me')
  findMyInstitutionDonations(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: PaginationQuery,
  ) {
    return this.donationsService.findMyInstitutionDonations(user?.sub, query);
  }

  @Get()
  findAll(@Query() query: PaginationQuery) {
    return this.donationsService.findAll(query);
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
