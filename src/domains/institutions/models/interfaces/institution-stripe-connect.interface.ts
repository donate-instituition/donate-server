export interface InstitutionStripeConnect {
  accountId?: string;
  chargesEnabled?: boolean;
  country?: string;
  defaultCurrency?: string;
  detailsSubmitted?: boolean;
  exists?: boolean;
  livemode?: boolean;
  payoutsEnabled?: boolean;
  ready?: boolean;
  requirementsCurrentlyDue?: string[];
  requirementsDisabledReason?: string;
  verifiedAt?: Date;
}
