import type { RegisterAccountType } from './register.dto';

export class CompleteGoogleOnboardingDto {
  onboardingToken!: string;

  accountType!: RegisterAccountType;

  cpf!: string;

  birthDate!: string;

  phone!: string;

  /** Optional — lets the person also log in with email/password later. */
  password?: string;

  institutionLegalName?: string;

  institutionDisplayName?: string;

  institutionCnpj?: string;

  institutionEmail?: string;

  institutionPhone?: string;

  institutionDescription?: string;

  institutionWebsite?: string;
}
