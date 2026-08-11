import { promises as fs } from 'fs';
import { join } from 'path';

import { env } from '../config/env';
import { ObjectStorageService } from './object-storage.service';

const sendMock = jest.fn().mockResolvedValue({});

jest.mock('@aws-sdk/client-s3', () => ({
  CopyObjectCommand: jest.fn().mockImplementation((input) => ({
    type: 'CopyObjectCommand',
    input,
  })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({
    type: 'DeleteObjectCommand',
    input,
  })),
  GetObjectCommand: jest.fn(),
  PutObjectCommand: jest.fn(),
  S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
}));

describe('ObjectStorageService.moveObject', () => {
  const originalDriver = env.objectStorageDriver;
  const originalBucket = env.s3Bucket;

  afterEach(() => {
    env.objectStorageDriver = originalDriver;
    env.s3Bucket = originalBucket;
    sendMock.mockClear();
  });

  it('copies then deletes the source object when using the s3 driver', async () => {
    env.objectStorageDriver = 's3';
    env.s3Bucket = 'test-bucket';

    const service = new ObjectStorageService();

    await service.moveObject({
      fromKey: 'temp/upload-1/file.jpg',
      toKey: 'public/users/user-1/avatar/file.jpg',
    });

    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock.mock.calls[0][0]).toMatchObject({
      type: 'CopyObjectCommand',
      input: {
        Bucket: 'test-bucket',
        CopySource: 'test-bucket/temp/upload-1/file.jpg',
        Key: 'public/users/user-1/avatar/file.jpg',
      },
    });
    expect(sendMock.mock.calls[1][0]).toMatchObject({
      type: 'DeleteObjectCommand',
      input: {
        Bucket: 'test-bucket',
        Key: 'temp/upload-1/file.jpg',
      },
    });
  });

  it('renames the file on disk when using the local driver', async () => {
    env.objectStorageDriver = 'local';

    const service = new ObjectStorageService();
    const localStorageDir = join(process.cwd(), 'storage');
    const fromPath = join(localStorageDir, 'temp/upload-2/file.jpg');
    const toPath = join(localStorageDir, 'public/users/user-2/avatar/file.jpg');

    await fs.mkdir(join(localStorageDir, 'temp/upload-2'), {
      recursive: true,
    });
    await fs.writeFile(fromPath, 'fake-image-bytes');

    try {
      await service.moveObject({
        fromKey: 'temp/upload-2/file.jpg',
        toKey: 'public/users/user-2/avatar/file.jpg',
      });

      await expect(fs.readFile(toPath, 'utf-8')).resolves.toBe(
        'fake-image-bytes',
      );
      await expect(fs.access(fromPath)).rejects.toThrow();
    } finally {
      await fs.rm(join(localStorageDir, 'temp'), {
        recursive: true,
        force: true,
      });
      await fs.rm(join(localStorageDir, 'public'), {
        recursive: true,
        force: true,
      });
    }
  });
});
