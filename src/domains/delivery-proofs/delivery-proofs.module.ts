import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  DeliveryProof,
  DeliveryProofSchema,
} from './schemas/delivery-proof.schema';
import { DeliveryProofsController } from './delivery-proofs.controller';
import { DeliveryProofsService } from './delivery-proofs.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DeliveryProof.name, schema: DeliveryProofSchema },
    ]),
  ],
  controllers: [DeliveryProofsController],
  providers: [DeliveryProofsService],
})
export class DeliveryProofsModule {}
