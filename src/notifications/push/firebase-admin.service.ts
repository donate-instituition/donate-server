import { Injectable, Logger } from '@nestjs/common';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Message } from 'firebase-admin/messaging';

import { env } from '../../config/env';

type FirebaseServiceAccount = {
  clientEmail: string;
  privateKey: string;
  projectId: string;
};

@Injectable()
export class FirebaseAdminService {
  private readonly logger = new Logger(FirebaseAdminService.name);

  private getServiceAccount(): FirebaseServiceAccount | null {
    if (env.firebaseServiceAccountJson) {
      const serviceAccount = JSON.parse(env.firebaseServiceAccountJson) as {
        client_email?: string;
        private_key?: string;
        project_id?: string;
      };

      if (
        serviceAccount.client_email &&
        serviceAccount.private_key &&
        serviceAccount.project_id
      ) {
        return {
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key,
          projectId: serviceAccount.project_id,
        };
      }
    }

    if (
      env.firebaseClientEmail &&
      env.firebasePrivateKey &&
      env.firebaseProjectId
    ) {
      return {
        clientEmail: env.firebaseClientEmail,
        privateKey: env.firebasePrivateKey,
        projectId: env.firebaseProjectId,
      };
    }

    return null;
  }

  isConfigured() {
    return env.fcmEnabled && Boolean(this.getServiceAccount());
  }

  async send(message: Message) {
    if (!this.isConfigured()) {
      this.logger.warn('Firebase Admin is not configured; push skipped.');
      return undefined;
    }

    const serviceAccount = this.getServiceAccount();

    if (!serviceAccount) {
      return undefined;
    }

    const app = getApps().length
      ? getApp()
      : initializeApp({
          credential: cert({
            clientEmail: serviceAccount.clientEmail,
            privateKey: serviceAccount.privateKey,
            projectId: serviceAccount.projectId,
          }),
          projectId: serviceAccount.projectId,
        });

    return getMessaging(app).send(message);
  }
}
