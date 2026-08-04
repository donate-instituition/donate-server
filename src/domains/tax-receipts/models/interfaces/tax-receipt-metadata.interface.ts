export interface TaxReceiptMetadata {
  donorCpfMasked?: string;
  institutionCnpj?: string;
  campaignTitle?: string;
  donationKind?: string;
  grossAmount?: number;
  netAmount?: number;
  paymentId?: string;
  serviceFeeAmount?: number;
  serviceFeeBps?: number;
  storageBucket?: string;
  storageChecksum?: string;
  storageContentType?: string;
  storageObjectKey?: string;
  storageProvider?: string;
  storageSize?: number;
  year?: number;
}
