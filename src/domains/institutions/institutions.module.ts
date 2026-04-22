import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Institution, InstitutionSchema } from './schemas/institution.schema';
import { InstitutionsController } from './institutions.controller';
import { InstitutionsService } from './institutions.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Institution.name, schema: InstitutionSchema },
    ]),
  ],
  controllers: [InstitutionsController],
  providers: [InstitutionsService],
})
export class InstitutionsModule {}
