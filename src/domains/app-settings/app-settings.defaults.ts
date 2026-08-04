import { env } from '../../config/env';
import { AppSettingValueType } from './schemas/app-setting.schema';

export enum AppSettingKey {
  EMAIL_ACCOUNT_ACTIVATION_URL = 'EMAIL_ACCOUNT_ACTIVATION_URL',
  EMAIL_BRAND_HERO_URL = 'EMAIL_BRAND_HERO_URL',
  EMAIL_BRAND_LOGO_URL = 'EMAIL_BRAND_LOGO_URL',
  EMAIL_PUBLIC_APP_URL = 'EMAIL_PUBLIC_APP_URL',
  EMAIL_SUPPORT_EMAIL = 'EMAIL_SUPPORT_EMAIL',
  EMAIL_SUPPORT_PHONE = 'EMAIL_SUPPORT_PHONE',
  STRIPE_SERVICE_FEE_BPS = 'STRIPE_SERVICE_FEE_BPS',
}

export const appSettingDefaults = [
  {
    key: AppSettingKey.EMAIL_SUPPORT_EMAIL,
    value: env.emailSupportEmail,
    valueType: AppSettingValueType.STRING,
    description: 'E-mail exibido nos canais de suporte e rodapé dos e-mails.',
  },
  {
    key: AppSettingKey.EMAIL_SUPPORT_PHONE,
    value: env.emailSupportPhone,
    valueType: AppSettingValueType.STRING,
    description: 'Telefone/WhatsApp exibido nos canais de suporte e rodapé dos e-mails.',
  },
  {
    key: AppSettingKey.EMAIL_PUBLIC_APP_URL,
    value: env.emailPublicAppUrl,
    valueType: AppSettingValueType.STRING,
    description: 'URL pública usada em links de e-mail para abrir o EloDoar.',
  },
  {
    key: AppSettingKey.EMAIL_ACCOUNT_ACTIVATION_URL,
    value: env.emailAccountActivationUrl,
    valueType: AppSettingValueType.STRING,
    description: 'URL base usada para montar links de ativação de conta.',
  },
  {
    key: AppSettingKey.EMAIL_BRAND_LOGO_URL,
    value: env.emailBrandLogoUrl,
    valueType: AppSettingValueType.STRING,
    description: 'URL do logo usado nos e-mails transacionais.',
  },
  {
    key: AppSettingKey.EMAIL_BRAND_HERO_URL,
    value: env.emailBrandHeroUrl,
    valueType: AppSettingValueType.STRING,
    description: 'URL da imagem de destaque usada nos e-mails transacionais.',
  },
  {
    key: AppSettingKey.STRIPE_SERVICE_FEE_BPS,
    value: env.stripeServiceFeeBps,
    valueType: AppSettingValueType.NUMBER,
    description: 'Taxa da plataforma em basis points. Ex.: 500 = 5%.',
  },
] as const;
