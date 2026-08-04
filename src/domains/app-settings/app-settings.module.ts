import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AppSettingsController } from './app-settings.controller';
import { AppSettingsService } from './app-settings.service';
import { AppSetting, AppSettingSchema } from './schemas/app-setting.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AppSetting.name, schema: AppSettingSchema },
    ]),
  ],
  controllers: [AppSettingsController],
  providers: [AppSettingsService],
  exports: [AppSettingsService],
})
export class AppSettingsModule {}
