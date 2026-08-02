export type RegisterAccountType = 'DONOR' | 'INSTITUTION';

export class RegisterDto {
  accountType?: RegisterAccountType;

  name!: string;

  email!: string;

  password!: string;

  cpf!: string;

  birthDate!: string;

  phone!: string;

  institutionLegalName?: string;

  institutionDisplayName?: string;

  institutionCnpj?: string;

  institutionEmail?: string;

  institutionPhone?: string;

  institutionDescription?: string;

  institutionWebsite?: string;
}
