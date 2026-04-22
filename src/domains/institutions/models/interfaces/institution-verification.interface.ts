export interface InstitutionVerification {
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedByUserId?: string;
  notes?: string;
  documents?: string[];
}
