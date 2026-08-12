import { Controller, Get, Header, Query } from '@nestjs/common';

import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';

// Root-level (no /auth prefix) so this path can double as the Android App
// Link target declared in app.json (intentFilters pathPrefix: /activate-account).
// When the app is installed, Android opens it there instead of the browser;
// this page is only reached as the web fallback when it isn't.
@Controller()
export class AccountActivationLandingController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('activate-account')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async activateAccountFromEmail(@Query('token') token: string) {
    const result = await this.authService.activateAccount({ token });
    const email = result.email
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Conta ativada - EloDoar</title>
  </head>
  <body style="margin:0;background:#FAFCFA;color:#17211D;font-family:Arial,Helvetica,sans-serif;">
    <main style="max-width:560px;margin:48px auto;padding:32px;background:#FFFFFF;border:1px solid #E8EEEA;border-radius:20px;text-align:center;">
      <div style="width:64px;height:64px;margin:0 auto 18px;border-radius:20px;background:#DFF3EA;color:#167A5A;font-size:34px;line-height:64px;">&hearts;</div>
      <h1 style="margin:0 0 12px;color:#083B2D;font-size:30px;line-height:36px;">Conta ativada</h1>
      <p style="margin:0 0 8px;color:#3B4742;font-size:16px;line-height:26px;">Sua conta EloDoar foi ativada com sucesso.</p>
      <p style="margin:0;color:#69756F;font-size:14px;line-height:22px;">Agora você já pode voltar ao app e entrar com o email ${email}.</p>
    </main>
  </body>
</html>`;
  }
}
