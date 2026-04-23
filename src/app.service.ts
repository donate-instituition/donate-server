import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getApiInfo() {
    return {
      name: 'donate-server',
      status: 'ok',
      domains: [
        'users',
        'audit-logs',
        'institutions',
        'institution-staff-memberships',
        'campaigns',
        'categories',
        'conversations',
        'delivery-proofs',
        'donations',
        'donation-status-history',
        'follows',
        'messages',
        'notifications',
        'payments',
        'post-comments',
        'post-reactions',
        'posts',
        'reports',
        'tax-receipts',
        'tracking-events',
      ],
    };
  }
}
