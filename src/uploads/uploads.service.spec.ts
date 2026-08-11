import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';

import { UserRole, UserStatus, UserType } from '../domains/users/models';
import { UploadCategory } from './models';
import { UploadsService } from './uploads.service';

function chain(result: unknown) {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(result),
      }),
    }),
  };
}

function createUser(overrides: Record<string, unknown> = {}) {
  return {
    sub: new Types.ObjectId().toString(),
    email: 'donor@example.com',
    roles: [UserRole.DONOR],
    type: UserType.PERSON,
    status: UserStatus.ACTIVE,
    ...overrides,
  };
}

describe('UploadsService', () => {
  let institutionStaffMembershipModel: {
    exists: jest.Mock;
  };
  let campaignModel: { findById: jest.Mock };
  let donationModel: { findById: jest.Mock };
  let objectStorageService: { moveObject: jest.Mock; putObject: jest.Mock };

  function createService() {
    return new UploadsService(
      institutionStaffMembershipModel as any,
      campaignModel as any,
      donationModel as any,
      objectStorageService as any,
    );
  }

  beforeEach(() => {
    institutionStaffMembershipModel = {
      exists: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    };
    campaignModel = { findById: jest.fn().mockReturnValue(chain(null)) };
    donationModel = { findById: jest.fn().mockReturnValue(chain(null)) };
    objectStorageService = {
      moveObject: jest.fn().mockResolvedValue(undefined),
      putObject: jest.fn().mockResolvedValue({
        checksum: 'abc',
        contentType: 'image/jpeg',
        key: 'temp/upload-1/a.jpg',
        provider: 'local',
        size: 4,
      }),
    };
  });

  describe('createUpload', () => {
    it('rejects a content type not allowed for the category', async () => {
      const service = createService();

      await expect(
        service.createUpload({
          base64: Buffer.from('data').toString('base64'),
          category: UploadCategory.USER_AVATAR,
          contentType: 'application/pdf',
          filename: 'a.pdf',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a body larger than the category limit', async () => {
      const service = createService();
      const oversized = Buffer.alloc(6 * 1024 * 1024).toString('base64');

      await expect(
        service.createUpload({
          base64: oversized,
          category: UploadCategory.USER_AVATAR,
          contentType: 'image/jpeg',
          filename: 'a.jpg',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('stores the body under a temp/ key and returns the upload metadata', async () => {
      const service = createService();

      const result = await service.createUpload({
        base64: Buffer.from('fake-image').toString('base64'),
        category: UploadCategory.USER_AVATAR,
        contentType: 'image/jpeg',
        filename: 'a.jpg',
      });

      expect(objectStorageService.putObject).toHaveBeenCalledTimes(1);
      const putObjectInput = objectStorageService.putObject.mock.calls[0][0];
      expect(putObjectInput.key).toMatch(
        new RegExp(`^temp/${result.uploadId}/`),
      );
      expect(result).toMatchObject({
        category: UploadCategory.USER_AVATAR,
        contentType: 'image/jpeg',
      });
    });
  });

  describe('confirmUpload', () => {
    it('rejects an invalid category', async () => {
      const service = createService();

      await expect(
        service.confirmUpload(
          'upload-1',
          { category: 'NOT_REAL' as UploadCategory, fileName: 'a.jpg' },
          createUser(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('always allows confirming a user avatar for the current user and returns a public url', async () => {
      const service = createService();
      const user = createUser();

      const result = await service.confirmUpload(
        'upload-1',
        { category: UploadCategory.USER_AVATAR, fileName: 'a.jpg' },
        user,
      );

      expect(objectStorageService.moveObject).toHaveBeenCalledWith({
        fromKey: 'temp/upload-1/a.jpg',
        toKey: `public/users/${user.sub}/avatar/a.jpg`,
      });
      expect(result.key).toBe(`public/users/${user.sub}/avatar/a.jpg`);
      expect(result.url).toContain('/uploads/public?key=');
    });

    it('rejects confirming an institution logo without an institutionId', async () => {
      const service = createService();

      await expect(
        service.confirmUpload(
          'upload-1',
          { category: UploadCategory.INSTITUTION_LOGO, fileName: 'l.png' },
          createUser(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects confirming an institution logo without an active membership', async () => {
      const service = createService();

      await expect(
        service.confirmUpload(
          'upload-1',
          {
            category: UploadCategory.INSTITUTION_LOGO,
            fileName: 'l.png',
            institutionId: new Types.ObjectId().toString(),
          },
          createUser(),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('confirms an institution logo for an active staff member', async () => {
      institutionStaffMembershipModel.exists.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
      });

      const service = createService();
      const institutionId = new Types.ObjectId().toString();

      const result = await service.confirmUpload(
        'upload-1',
        {
          category: UploadCategory.INSTITUTION_LOGO,
          fileName: 'l.png',
          institutionId,
        },
        createUser(),
      );

      expect(result.key).toBe(
        `public/institutions/${institutionId}/logo/l.png`,
      );
      expect(result.url).toBeDefined();
    });

    it('scopes a delivery proof under the campaign and returns a private key without a url', async () => {
      const campaignId = new Types.ObjectId();
      const institutionId = new Types.ObjectId();
      campaignModel.findById.mockReturnValue(chain({ institutionId }));
      institutionStaffMembershipModel.exists.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
      });

      const service = createService();

      const result = await service.confirmUpload(
        'upload-1',
        {
          campaignId: campaignId.toString(),
          category: UploadCategory.DELIVERY_PROOF,
          fileName: 'p.pdf',
        },
        createUser(),
      );

      expect(result.key).toBe(
        `private/campaigns/${campaignId.toString()}/proofs/p.pdf`,
      );
      expect((result as { url?: string }).url).toBeUndefined();
    });
  });
});
