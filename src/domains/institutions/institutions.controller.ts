import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { Public } from '../../auth/decorators/public.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { UserRole } from '../users/models';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { VerifyStripeConnectAccountDto } from './dto/verify-stripe-connect-account.dto';
import { InstitutionsService } from './institutions.service';

@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Post()
  create(@Body() createInstitutionDto: CreateInstitutionDto) {
    return this.institutionsService.create(createInstitutionDto);
  }

  @Public()
  @Get()
  findAll() {
    return this.institutionsService.findAll();
  }

  @Roles(UserRole.PLATFORM_ADMIN)
  @Get('admin/pending')
  findPending() {
    return this.institutionsService.findPending();
  }

  @Roles(UserRole.PLATFORM_ADMIN)
  @Get('admin')
  findAllForAdmin() {
    return this.institutionsService.findAllForAdmin();
  }

  @Roles(UserRole.PLATFORM_ADMIN)
  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.institutionsService.approve(id, user?.sub);
  }

  @Roles(UserRole.PLATFORM_ADMIN)
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.institutionsService.reject(id, user?.sub);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.institutionsService.findOne(id);
  }

  @Post(':id/stripe/connect-account')
  verifyStripeConnectAccount(
    @Param('id') id: string,
    @Body() verifyStripeConnectAccountDto: VerifyStripeConnectAccountDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.institutionsService.verifyStripeConnectAccount(
      id,
      verifyStripeConnectAccountDto,
      user?.sub,
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateInstitutionDto: UpdateInstitutionDto,
  ) {
    return this.institutionsService.update(id, updateInstitutionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.institutionsService.remove(id);
  }
}
