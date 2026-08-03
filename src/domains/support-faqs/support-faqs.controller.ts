import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../users/models';
import { CreateSupportFaqDto } from './dto/create-support-faq.dto';
import { UpdateSupportFaqDto } from './dto/update-support-faq.dto';
import { SupportFaqsService } from './support-faqs.service';

@Controller('support-faqs')
export class SupportFaqsController {
  constructor(private readonly supportFaqsService: SupportFaqsService) {}

  @Roles(UserRole.PLATFORM_ADMIN)
  @Post()
  create(@Body() createSupportFaqDto: CreateSupportFaqDto) {
    return this.supportFaqsService.create(createSupportFaqDto);
  }

  @Roles(UserRole.PLATFORM_ADMIN)
  @Get()
  findAll() {
    return this.supportFaqsService.findAll();
  }

  @Public()
  @Get('current')
  findCurrent() {
    return this.supportFaqsService.findCurrent();
  }

  @Roles(UserRole.PLATFORM_ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.supportFaqsService.findOne(id);
  }

  @Roles(UserRole.PLATFORM_ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSupportFaqDto: UpdateSupportFaqDto) {
    return this.supportFaqsService.update(id, updateSupportFaqDto);
  }

  @Roles(UserRole.PLATFORM_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.supportFaqsService.remove(id);
  }
}
