import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { TaxReceipt, TaxReceiptSchema } from './schemas/tax-receipt.schema';
import { TaxReceiptsController } from './tax-receipts.controller';
import { TaxReceiptsService } from './tax-receipts.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TaxReceipt.name, schema: TaxReceiptSchema },
    ]),
  ],
  controllers: [TaxReceiptsController],
  providers: [TaxReceiptsService],
})
export class TaxReceiptsModule {}
