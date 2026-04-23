import { Types } from 'mongoose';

import { PaymentGateway, PaymentMethod, PaymentStatus } from '../models';
import type { PaymentGatewayPayload, PaymentPix } from '../models';

export class CreatePaymentDto {
  donationId!: Types.ObjectId;

  donorUserId!: Types.ObjectId;

  institutionId!: Types.ObjectId;

  gateway!: PaymentGateway;

  gatewayTransactionId?: string;

  paymentMethod!: PaymentMethod;

  amount!: number;

  currency!: string;

  status?: PaymentStatus;

  pix?: PaymentPix;

  gatewayPayload?: PaymentGatewayPayload;

  paidAt?: Date;

  refundedAt?: Date;
}
