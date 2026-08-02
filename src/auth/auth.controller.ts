import { Body, Controller, Get, Patch, Post } from '@nestjs/common';

import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateMySettingsDto } from './dto/update-my-settings.dto';
import type { AuthenticatedUser } from './types/authenticated-user.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

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
  @Post('forgot-password')
  forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body);
  }

  @Post('logout')
  logout(@Body() body: { refreshToken?: string }, @CurrentUser() user: AuthenticatedUser | undefined) {
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
}
