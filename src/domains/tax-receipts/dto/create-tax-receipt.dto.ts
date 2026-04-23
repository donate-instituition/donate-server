import { Types } from 'mongoose';

import { TaxReceiptType } from '../models';
import type { TaxReceiptMetadata } from '../models';

export class CreateTaxReceiptDto {
  donationId!: Types.ObjectId;

  donorUserId!: Types.ObjectId;

  institutionId!: Types.ObjectId;

  receiptNumber!: string;

  type!: TaxReceiptType;

  amount!: number;

  issuedAt!: Date;

  documentUrl?: string;

  metadata?: TaxReceiptMetadata;
}
