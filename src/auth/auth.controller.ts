import {
  Body,
  Controller,
  Get,
  Header,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { CompleteGoogleOnboardingDto } from './dto/complete-google-onboarding.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateMySettingsDto } from './dto/update-my-settings.dto';
import type { AuthenticatedUser } from './types/authenticated-user.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken);
  }

  @Public()
  @Post('google')
  loginWithGoogle(@Body() googleLoginDto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(googleLoginDto);
  }

  @Public()
  @Post('google/onboarding')
  completeGoogleOnboarding(
    @Body() completeGoogleOnboardingDto: CompleteGoogleOnboardingDto,
  ) {
    return this.authService.completeGoogleOnboarding(
      completeGoogleOnboardingDto,
    );
  }

  @Public()
  @Post('activate-account')
  activateAccount(@Body() body: { token: string }) {
    return this.authService.activateAccount(body);
  }

  @Public()
  @Post('resend-activation')
  resendActivationEmail(@Body() body: { email: string }) {
    return this.authService.resendActivationEmail(body);
  }

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

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body);
  }

  @Public()
  @Post('forgot-password/confirm')
  confirmForgotPassword(@Body() body: { email: string; code: string }) {
    return this.authService.confirmForgotPassword(body);
  }

  @Post('logout')
  logout(
    @Body() body: { refreshToken?: string },
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.authService.logout(body.refreshToken, user?.sub);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser | undefined) {
    return user;
  }

  @Patch('me/settings')
  updateMySettings(
    @Body() body: UpdateMySettingsDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.authService.updateMySettings(user, body);
  }

  @Patch('me/password')
  changePassword(
    @Body() body: { currentPassword: string; newPassword: string },
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.authService.changePassword(user, body);
  }
}
