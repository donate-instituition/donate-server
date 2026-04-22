import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getApiInfo() {
    return {
      name: 'donate-server',
      status: 'ok',
      domains: ['users', 'institutions'],
    };
  }
}
