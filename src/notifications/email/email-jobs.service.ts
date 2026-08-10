import { Injectable } from '@nestjs/common';

import { env } from '../../config/env';
import { AppSettingKey } from '../../domains/app-settings/app-settings.defaults';
import { AppSettingsService } from '../../domains/app-settings/app-settings.service';
import { createQueueMessage } from '../../queues/queue-message';
import { RabbitMqPublisherService } from '../../queues/rabbitmq-publisher.service';

type SendAccountCreatedEmailInput = {
  accountStatus?: 'pending-approval' | 'pending-verification';
  activationUrl?: string;
  initialPassword?: string;
  passwordChangeRequired?: boolean;
  name: string;
  userId: string;
  to: string;
};

type SendPasswordResetCodeEmailInput = {
  code: string;
  jobId?: string;
  name: string;
  userId: string;
  to: string;
};

type SendTemporaryPasswordEmailInput = {
  jobId?: string;
  name: string;
  temporaryPassword: string;
  userId: string;
  to: string;
};

type SendDonationReceiptEmailInput = {
  amountFormatted: string;
  campaignTitle: string;
  institutionName: string;
  name: string;
  receiptNumber: string;
  to: string;
  userId: string;
};

type BrandedEmailInput = {
  badge: string;
  bodyHtml: string;
  contactContext?: string;
  headline: string;
  highlight?: {
    label: string;
    value: string;
  };
  primaryAction?: {
    label: string;
    url: string;
  };
  preheader: string;
  securityNote?: string;
};

const brand = {
  accent: '#F4B942',
  background: '#FAFCFA',
  border: '#E8EEEA',
  coral: '#E86F51',
  ink: '#17211D',
  muted: '#69756F',
  primary: '#167A5A',
  primaryDark: '#083B2D',
  primarySoft: '#DFF3EA',
  surface: '#FFFFFF',
};

@Injectable()
export class EmailJobsService {
  constructor(
    private readonly rabbitMqPublisher: RabbitMqPublisherService,
    private readonly appSettingsService: AppSettingsService,
  ) {}

  private async getEmailSettings() {
    const [
      brandHeroUrl,
      brandLogoUrl,
      publicAppUrl,
      supportEmail,
      supportPhone,
    ] = await Promise.all([
      this.appSettingsService.getString(
        AppSettingKey.EMAIL_BRAND_HERO_URL,
        env.emailBrandHeroUrl,
      ),
      this.appSettingsService.getString(
        AppSettingKey.EMAIL_BRAND_LOGO_URL,
        env.emailBrandLogoUrl,
      ),
      this.appSettingsService.getString(
        AppSettingKey.EMAIL_PUBLIC_APP_URL,
        env.emailPublicAppUrl,
      ),
      this.appSettingsService.getString(
        AppSettingKey.EMAIL_SUPPORT_EMAIL,
        env.emailSupportEmail,
      ),
      this.appSettingsService.getString(
        AppSettingKey.EMAIL_SUPPORT_PHONE,
        env.emailSupportPhone,
      ),
    ]);

    return {
      brandHeroUrl,
      brandLogoUrl,
      publicAppUrl,
      supportEmail,
      supportPhone,
    };
  }

  async sendAccountCreatedEmail(input: SendAccountCreatedEmailInput) {
    const isPendingApproval = input.accountStatus === 'pending-approval';
    const subject = isPendingApproval
      ? 'Recebemos seu cadastro no Elodoar'
      : 'Ative sua conta no Elodoar';
    const text = isPendingApproval
      ? `Olá, ${input.name}. Recebemos o cadastro da sua instituição no Elodoar. Nossa equipe irá revisar as informações da instituição antes de liberar o acesso.`
      : `Olá, ${input.name}. Sua conta no Elodoar foi criada. Para acessar a plataforma, ative sua conta seguindo as instruções deste e-mail.`;

    const html = this.renderBrandedEmail(await this.getEmailSettings(), {
      badge: isPendingApproval ? 'Cadastro recebido' : 'Conta criada',
      bodyHtml: isPendingApproval
        ? `<p>Olá, ${this.escapeHtml(input.name)}.</p><p>Recebemos o cadastro da sua instituição no Elodoar. Nossa equipe irá revisar as informações enviadas e avisaremos quando houver uma atualização.</p><p>Enquanto isso, mantenha seus dados de contato atualizados para que possamos falar com você se precisar.</p>`
        : `<p>Olá, ${this.escapeHtml(input.name)}.</p><p>Sua conta no Elodoar foi criada com sucesso. Para manter a plataforma segura, confirme a ativação da conta antes de entrar.</p>${input.initialPassword ? `<p>Use a senha enviada abaixo para fazer o primeiro acesso${input.passwordChangeRequired ? '. Você precisará criar uma nova senha ao entrar.' : '.'}</p>` : '<p>Depois da ativação, você poderá acompanhar campanhas, instituições e doações pelo app.</p>'}`,
      contactContext: isPendingApproval
        ? 'Se tiver dúvidas sobre a análise da instituição, fale com o suporte.'
        : 'Se você não criou essa conta, fale com o suporte para que possamos proteger seus dados.',
      headline: isPendingApproval
        ? 'Estamos analisando sua instituição'
        : 'Bem-vindo ao EloDoar',
      preheader: isPendingApproval
        ? 'Recebemos seu cadastro e vamos revisar sua instituição.'
        : 'Sua conta foi criada e precisa ser ativada antes do acesso.',
      primaryAction: input.activationUrl
        ? {
            label: 'Ativar minha conta',
            url: input.activationUrl,
          }
        : undefined,
      highlight: input.initialPassword
        ? {
            label: 'Senha inicial',
            value: input.initialPassword,
          }
        : undefined,
      securityNote: isPendingApproval
        ? 'A aprovação institucional é feita pela equipe da plataforma. Nunca envie documentos sensíveis fora dos canais oficiais.'
        : 'Nunca compartilhe seus dados de acesso. O EloDoar não solicita sua senha por email.',
    });

    await this.rabbitMqPublisher.publish(
      'email.send',
      createQueueMessage({
        idempotencyKey: `email:account-created:${input.userId}`,
        payload: {
          html,
          metadata: {
            accountStatus: input.accountStatus ?? 'active',
            template: 'account-created',
            userId: input.userId,
          },
          subject,
          text,
          to: input.to,
        },
        type: 'email.send',
      }),
    );
  }

  async sendPasswordResetCodeEmail(input: SendPasswordResetCodeEmailInput) {
    const text = `Olá, ${input.name}. Use o código ${input.code} no app para continuar a recuperação da senha. Este código expira em 15 minutos. Se você não solicitou essa recuperação, ignore este email.`;

    await this.rabbitMqPublisher.publish(
      'email.send',
      createQueueMessage({
        idempotencyKey: `email:password-reset-code:${input.userId}:${input.jobId ?? 'latest'}`,
        payload: {
          html: this.renderBrandedEmail(await this.getEmailSettings(), {
            badge: 'Recuperação de senha',
            bodyHtml: `<p>Olá, ${this.escapeHtml(input.name)}.</p><p>Recebemos uma solicitação para recuperar o acesso à sua conta EloDoar.</p><p>Digite o código abaixo no app para confirmar que foi você. Ele expira em 15 minutos.</p>`,
            contactContext:
              'Se você não solicitou essa recuperação, ignore este email ou fale com o suporte.',
            headline: 'Use este código no app',
            highlight: {
              label: 'Código de confirmação',
              value: input.code,
            },
            preheader: `Seu código de recuperação é ${input.code}.`,
            securityNote:
              'O EloDoar nunca pede sua senha por email, telefone ou mensagem. Use este código apenas dentro do app.',
          }),
          metadata: {
            template: 'password-reset-code',
            userId: input.userId,
          },
          subject: 'Código para recuperar sua senha no Elodoar',
          text,
          to: input.to,
        },
        type: 'email.send',
      }),
    );
  }

  async sendTemporaryPasswordEmail(input: SendTemporaryPasswordEmailInput) {
    const text = `Olá, ${input.name}. Sua senha temporária é ${input.temporaryPassword}. Ao entrar novamente no app, você precisará criar uma nova senha.`;

    await this.rabbitMqPublisher.publish(
      'email.send',
      createQueueMessage({
        idempotencyKey: `email:temporary-password:${input.userId}:${input.jobId ?? 'latest'}`,
        payload: {
          html: this.renderBrandedEmail(await this.getEmailSettings(), {
            badge: 'Senha temporária',
            bodyHtml: `<p>Olá, ${this.escapeHtml(input.name)}.</p><p>Seu código foi confirmado e criamos uma senha temporária para você acessar sua conta.</p><p>Entre no app usando a senha abaixo. Logo após o login, você será obrigado a criar uma nova senha definitiva.</p>`,
            contactContext:
              'Se você não pediu a recuperação de senha, fale com o suporte imediatamente.',
            headline: 'Sua senha temporária chegou',
            highlight: {
              label: 'Senha temporária',
              value: input.temporaryPassword,
            },
            preheader:
              'Criamos uma senha temporária para você recuperar o acesso.',
            securityNote:
              'Troque essa senha assim que entrar. Depois da troca, a senha temporária deixa de ser necessária.',
          }),
          metadata: {
            template: 'temporary-password',
            userId: input.userId,
          },
          subject: 'Sua senha temporária do Elodoar',
          text,
          to: input.to,
        },
        type: 'email.send',
      }),
    );
  }

  async sendDonationReceiptEmail(input: SendDonationReceiptEmailInput) {
    const text = `Olá, ${input.name}. Sua doação de ${input.amountFormatted} para ${input.campaignTitle} foi confirmada. Recibo: ${input.receiptNumber}.`;

    await this.rabbitMqPublisher.publish(
      'email.send',
      createQueueMessage({
        idempotencyKey: `email:donation-receipt:${input.receiptNumber}`,
        payload: {
          html: this.renderBrandedEmail(await this.getEmailSettings(), {
            badge: 'Doação confirmada',
            bodyHtml: `<p>Olá, ${this.escapeHtml(input.name)}.</p><p>Sua doação foi confirmada e enviada diretamente para a instituição pelo Stripe.</p><p><strong>Campanha:</strong> ${this.escapeHtml(input.campaignTitle)}<br><strong>Instituição:</strong> ${this.escapeHtml(input.institutionName)}</p>`,
            contactContext: 'Seu recibo também ficará disponível no app.',
            headline: 'Sua doação foi confirmada',
            highlight: {
              label: 'Valor doado',
              value: input.amountFormatted,
            },
            preheader: `Doação confirmada: ${input.amountFormatted}.`,
            securityNote:
              'Pagamentos são processados pela Stripe. O EloDoar nunca solicita dados do cartão por email ou mensagem.',
          }),
          metadata: {
            receiptNumber: input.receiptNumber,
            template: 'donation-receipt',
            userId: input.userId,
          },
          subject: 'Sua doação foi confirmada no EloDoar',
          text,
          to: input.to,
        },
        type: 'email.send',
      }),
    );
  }

  private renderBrandedEmail(
    settings: Awaited<ReturnType<EmailJobsService['getEmailSettings']>>,
    input: BrandedEmailInput,
  ) {
    const logo = settings.brandLogoUrl
      ? `<img src="${this.escapeAttribute(settings.brandLogoUrl)}" width="56" height="56" alt="EloDoar" style="display:block;border:0;border-radius:16px;object-fit:cover;">`
      : `<div style="width:56px;height:56px;border-radius:16px;background:${brand.primarySoft};color:${brand.primary};font-size:30px;line-height:56px;text-align:center;font-weight:800;">&hearts;</div>`;
    const hero = settings.brandHeroUrl
      ? `<tr><td><img src="${this.escapeAttribute(settings.brandHeroUrl)}" width="640" alt="Pessoas conectadas por doações" style="display:block;width:100%;max-width:640px;height:auto;border:0;"></td></tr>`
      : '';
    const supportItems = [
      settings.supportEmail
        ? `<a href="mailto:${this.escapeAttribute(settings.supportEmail)}" style="color:${brand.primary};font-weight:700;text-decoration:none;">${this.escapeHtml(settings.supportEmail)}</a>`
        : '',
      settings.supportPhone
        ? `<span style="color:${brand.ink};font-weight:700;">${this.escapeHtml(settings.supportPhone)}</span>`
        : '',
      settings.publicAppUrl
        ? `<a href="${this.escapeAttribute(settings.publicAppUrl)}" style="color:${brand.primary};font-weight:700;text-decoration:none;">Abrir EloDoar</a>`
        : '',
    ].filter(Boolean);

    const fallbackLink = input.primaryAction
      ? `<div style="margin:16px 0 0;padding:14px;border-radius:12px;background:#F4FBF8;border:1px solid ${brand.border};font-size:12px;line-height:18px;color:${brand.muted};">
          Se o botão não abrir, copie este link:<br>
          <a href="${this.escapeAttribute(input.primaryAction.url)}" style="color:${brand.primary};font-weight:700;text-decoration:none;word-break:break-all;">${this.escapeHtml(input.primaryAction.url)}</a>
        </div>`
      : '';
    const highlight = input.highlight
      ? `<div style="margin:28px 0;padding:22px;border-radius:14px;background:#F4FBF8;border:1px solid #BFE7D5;text-align:center;">
          <div style="font-size:12px;line-height:18px;color:${brand.primaryDark};font-weight:800;text-transform:uppercase;letter-spacing:.08em;">${this.escapeHtml(input.highlight.label)}</div>
          <div style="display:inline-block;margin-top:10px;padding:10px 14px;border-radius:10px;background:${brand.surface};border:1px solid ${brand.border};font-size:28px;line-height:34px;color:${brand.primaryDark};font-weight:900;font-family:Arial,Helvetica,sans-serif;">${this.escapeHtml(input.highlight.value)}</div>
        </div>`
      : '';
    const primaryAction = input.primaryAction
      ? `<div style="margin:28px 0 10px;text-align:center;">
          <a href="${this.escapeAttribute(input.primaryAction.url)}" style="display:inline-block;background:${brand.primary};color:#FFFFFF;text-decoration:none;font-weight:900;font-size:16px;line-height:20px;padding:15px 24px;border-radius:12px;">${this.escapeHtml(input.primaryAction.label)}</a>
        </div>`
      : '';

    return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${this.escapeHtml(input.headline)}</title>
  </head>
  <body style="margin:0;padding:0;background:${brand.background};font-family:Arial,Helvetica,sans-serif;color:${brand.ink};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${this.escapeHtml(input.preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${brand.background};padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;background:${brand.surface};border:1px solid ${brand.border};border-radius:20px;overflow:hidden;">
            <tr>
              <td style="background:${brand.primary};padding:28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="68" valign="middle">${logo}</td>
                    <td valign="middle">
                      <div style="font-size:24px;line-height:30px;font-weight:900;color:#FFFFFF;">EloDoar</div>
                      <div style="font-size:14px;line-height:20px;color:#DFF3EA;">Doações que conectam pessoas e instituições</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${hero}
            <tr>
              <td style="padding:34px 30px 18px;">
                <div style="display:inline-block;padding:7px 12px;border-radius:999px;background:${brand.primarySoft};color:${brand.primaryDark};font-size:12px;line-height:16px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;">${this.escapeHtml(input.badge)}</div>
                <h1 style="margin:18px 0 14px;font-size:28px;line-height:34px;color:${brand.primaryDark};font-weight:900;">${this.escapeHtml(input.headline)}</h1>
                <div style="font-size:16px;line-height:26px;color:${brand.ink};">${input.bodyHtml}</div>
                ${primaryAction}
                ${fallbackLink}
                ${highlight}
                <div style="margin-top:24px;padding:18px;border-left:4px solid ${brand.coral};background:#FFF7F4;border-radius:12px;color:${brand.ink};font-size:14px;line-height:22px;">
                  <strong style="color:${brand.primaryDark};">Segurança:</strong> ${this.escapeHtml(input.securityNote ?? 'Cuide dos seus dados e use apenas os canais oficiais do EloDoar.')}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 34px;">
                <div style="border-top:1px solid ${brand.border};padding-top:22px;font-size:14px;line-height:22px;color:${brand.muted};">
                  <p style="margin:0 0 10px;">${this.escapeHtml(input.contactContext ?? 'Precisa de ajuda? Fale com a equipe EloDoar.')}</p>
                  <p style="margin:0;">${supportItems.length ? supportItems.join(' &nbsp;|&nbsp; ') : 'Equipe EloDoar'}</p>
                </div>
              </td>
            </tr>
          </table>
          <div style="max-width:640px;margin:18px auto 0;font-size:12px;line-height:18px;color:${brand.muted};text-align:center;">
            Este email foi enviado automaticamente pelo EloDoar. Por favor, não responda esta mensagem.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private escapeAttribute(value: string) {
    return this.escapeHtml(value).replace(/`/g, '&#096;');
  }
}
