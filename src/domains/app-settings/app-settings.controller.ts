import { Body, Controller, Get, Param, Put } from '@nestjs/common';

import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../users/models';
import { AppSettingsService } from './app-settings.service';
import { UpsertAppSettingDto } from './dto/upsert-app-setting.dto';

@Controller('app-settings')
export class AppSettingsController {
  constructor(private readonly appSettingsService: AppSettingsService) {}

  @Roles(UserRole.PLATFORM_ADMIN)
  @Get()
  findAll() {
    return this.appSettingsService.findAll();
  }

  @Roles(UserRole.PLATFORM_ADMIN)
  @Get(':key')
  findOne(@Param('key') key: string) {
    return this.appSettingsService.findOne(key);
  }

  @Roles(UserRole.PLATFORM_ADMIN)
  @Put(':key')
  upsert(@Param('key') key: string, @Body() body: Omit<UpsertAppSettingDto, 'key'>) {
    return this.appSettingsService.upsert({ ...body, key });
  }
}
