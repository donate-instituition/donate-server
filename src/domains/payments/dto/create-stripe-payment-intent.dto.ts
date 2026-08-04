export class CreateStripePaymentIntentDto {
  amountCents!: number;

  campaignId!: string;

  paymentMethod?: 'card' | 'pix';

  donationKind?: 'single' | 'monthly';

  receiptEmail?: string;

  savePaymentMethod?: boolean;
}
