export class RegisterPushTokenDto {
  appVersion?: string;

  deviceId?: string;

  platform?: 'android' | 'ios' | 'web' | 'unknown';

  token!: string;
}
