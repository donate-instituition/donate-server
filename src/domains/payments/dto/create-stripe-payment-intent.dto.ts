export class CreateStripePaymentIntentDto {
  amountCents!: number;

  campaignId!: string;

  paymentMethod?: 'card' | 'pix';

  receiptEmail?: string;

  savePaymentMethod?: boolean;
}
