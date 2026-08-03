import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UsersModule } from '../users/users.module';
import { Term, TermSchema } from './schemas/term.schema';
import { TermsController } from './terms.controller';
import { TermsService } from './terms.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Term.name, schema: TermSchema }]),
    UsersModule,
  ],
  controllers: [TermsController],
  providers: [TermsService],
})
export class TermsModule {}
