import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';

import { env } from '../config/env';
import type { PutObjectInput, StoredObject } from './object-storage.types';

@Injectable()
export class ObjectStorageService {
  private readonly localStorageDir = join(process.cwd(), 'storage');
  private s3Client?: S3Client;

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    const checksum = createHash('sha256').update(input.body).digest('hex');

    if (env.objectStorageDriver === 's3') {
      await this.getS3Client().send(
        new PutObjectCommand({
          Body: input.body,
          Bucket: this.getS3Bucket(),
          ContentDisposition: input.contentDisposition,
          ContentType: input.contentType,
          Key: input.key,
          ServerSideEncryption: 'AES256',
        }),
      );

      return {
        bucket: this.getS3Bucket(),
        checksum,
        contentType: input.contentType,
        key: input.key,
        provider: 's3',
        size: input.body.byteLength,
      };
    }

    const absolutePath = join(this.localStorageDir, input.key);
    await fs.mkdir(dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, input.body);

    return {
      checksum,
      contentType: input.contentType,
      key: input.key,
      provider: 'local',
      size: input.body.byteLength,
    };
  }

  async getSignedDownloadUrl(input: {
    contentType?: string;
    filename?: string;
    key: string;
  }): Promise<string> {
    if (env.objectStorageDriver === 's3') {
      return getSignedUrl(
        this.getS3Client(),
        new GetObjectCommand({
          Bucket: this.getS3Bucket(),
          Key: input.key,
          ResponseContentDisposition: input.filename
            ? `inline; filename="${input.filename}"`
            : undefined,
          ResponseContentType: input.contentType,
        }),
        { expiresIn: env.objectStorageSignedUrlTtlSeconds },
      );
    }

    return join(this.localStorageDir, input.key);
  }

  private getS3Bucket() {
    if (!env.s3Bucket) {
      throw new Error(
        'S3_BUCKET must be configured when OBJECT_STORAGE_DRIVER=s3.',
      );
    }

    return env.s3Bucket;
  }

  private getS3Client() {
    if (this.s3Client) {
      return this.s3Client;
    }

    this.s3Client = new S3Client({
      credentials:
        env.s3AccessKeyId && env.s3SecretAccessKey
          ? {
              accessKeyId: env.s3AccessKeyId,
              secretAccessKey: env.s3SecretAccessKey,
            }
          : undefined,
      endpoint: env.s3Endpoint || undefined,
      forcePathStyle: env.s3ForcePathStyle,
      region: env.s3Region,
    });

    return this.s3Client;
  }
}
