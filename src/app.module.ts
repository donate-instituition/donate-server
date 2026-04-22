import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InstitutionsModule } from './domains/institutions/institutions.module';
import { UsersModule } from './domains/users/users.module';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb+srv://joaolucas19982_db_user:db_pass@hologacao.olfdhbv.mongodb.net/?appName=Hologacao'),
    UsersModule,
    InstitutionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
