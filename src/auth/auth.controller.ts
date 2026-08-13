import { Body, Controller, Get, Patch, Post } from '@nestjs/common';

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
