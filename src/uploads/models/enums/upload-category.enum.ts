// DONATION_RECEIPT is deliberately not a member here — receipts are
// generated server-side by donate-workers, writing directly to their
// final key. They never go through this client-facing upload flow.
export enum UploadCategory {
  USER_AVATAR = 'USER_AVATAR',
  USER_DOCUMENT = 'USER_DOCUMENT',
  INSTITUTION_LOGO = 'INSTITUTION_LOGO',
  INSTITUTION_COVER = 'INSTITUTION_COVER',
  INSTITUTION_DOCUMENT = 'INSTITUTION_DOCUMENT',
  INSTITUTION_REPORT = 'INSTITUTION_REPORT',
  CAMPAIGN_BANNER = 'CAMPAIGN_BANNER',
  POST_MEDIA = 'POST_MEDIA',
  DELIVERY_PROOF = 'DELIVERY_PROOF',
  DONATION_ATTACHMENT = 'DONATION_ATTACHMENT',
}
