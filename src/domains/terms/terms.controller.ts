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
import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { UserRole } from '../users/models';
import { CreateTermDto } from './dto/create-term.dto';
import { UpdateTermDto } from './dto/update-term.dto';
import { TermsService } from './terms.service';

@Controller('terms')
export class TermsController {
  constructor(private readonly termsService: TermsService) {}

  @Roles(UserRole.PLATFORM_ADMIN)
  @Post()
  create(@Body() createTermDto: CreateTermDto) {
    return this.termsService.create(createTermDto);
  }

  @Roles(UserRole.PLATFORM_ADMIN)
  @Get()
  findAll() {
    return this.termsService.findAll();
  }

  @Public()
  @Get('current')
  findCurrent() {
    return this.termsService.findCurrent();
  }

  @Post('accept-current')
  acceptCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.termsService.acceptCurrent(user.sub);
  }

  @Roles(UserRole.PLATFORM_ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.termsService.findOne(id);
  }

  @Roles(UserRole.PLATFORM_ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTermDto: UpdateTermDto) {
    return this.termsService.update(id, updateTermDto);
  }

  @Roles(UserRole.PLATFORM_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.termsService.remove(id);
  }
}
