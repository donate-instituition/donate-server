import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';

import { DeliveryProofsService } from './delivery-proofs.service';

function createCampaignModelMock(campaign: any) {
  return {
    findById: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(campaign),
        }),
      }),
    }),
  };
}

function createStaffMembershipModelMock(exists: boolean) {
  return {
    exists: jest.fn().mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue(exists ? { _id: 'membership-1' } : null),
    }),
  };
}

function createDeliveryProofModelMock(
  overrides: Partial<Record<string, any>> = {},
) {
  return {
    create: jest.fn().mockResolvedValue({
      _id: 'proof-1',
      campaignId: 'campaign-1',
      donationId: 'donation-1',
      photoUrl: 'https://example.com/proof.png',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    }),
    findById: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    }),
    findByIdAndUpdate: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    }),
    findByIdAndDelete: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: 'proof-1' }),
    }),
    ...overrides,
  };
}

const currentUser = { sub: new Types.ObjectId().toHexString() } as any;
const campaignId = new Types.ObjectId().toHexString();

describe('DeliveryProofsService', () => {
  it('creates a delivery proof when the user is active staff', async () => {
    const deliveryProofModel = createDeliveryProofModelMock();
    const campaignModel = createCampaignModelMock({ institutionId: 'inst-1' });
    const staffMembershipModel = createStaffMembershipModelMock(true);

    const service = new DeliveryProofsService(
      deliveryProofModel as any,
      campaignModel as any,
      staffMembershipModel as any,
    );

    const result = await service.create(
      {
        campaignId: campaignId as any,
        photoUrl: 'https://example.com/proof.png',
      } as any,
      currentUser,
    );

    expect(deliveryProofModel.create).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        id: 'proof-1',
        photoUrl: 'https://example.com/proof.png',
      }),
    );
  });

  it('throws ForbiddenException when no current user is provided', async () => {
    const service = new DeliveryProofsService(
      createDeliveryProofModelMock() as any,
      createCampaignModelMock(null) as any,
      createStaffMembershipModelMock(false) as any,
    );

    await expect(
      service.create(
        { campaignId: campaignId as any, photoUrl: 'x' } as any,
        undefined,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws BadRequestException when campaignId is missing', async () => {
    const service = new DeliveryProofsService(
      createDeliveryProofModelMock() as any,
      createCampaignModelMock(null) as any,
      createStaffMembershipModelMock(false) as any,
    );

    await expect(
      service.create({ photoUrl: 'x' } as any, currentUser),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when photoUrl is blank', async () => {
    const service = new DeliveryProofsService(
      createDeliveryProofModelMock() as any,
      createCampaignModelMock({ institutionId: 'inst-1' }) as any,
      createStaffMembershipModelMock(true) as any,
    );

    await expect(
      service.create(
        { campaignId: campaignId as any, photoUrl: '  ' } as any,
        currentUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when the campaign does not exist', async () => {
    const service = new DeliveryProofsService(
      createDeliveryProofModelMock() as any,
      createCampaignModelMock(null) as any,
      createStaffMembershipModelMock(true) as any,
    );

    await expect(
      service.create(
        { campaignId: campaignId as any, photoUrl: 'x' } as any,
        currentUser,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when the user is not an active staff member', async () => {
    const service = new DeliveryProofsService(
      createDeliveryProofModelMock() as any,
      createCampaignModelMock({ institutionId: 'inst-1' }) as any,
      createStaffMembershipModelMock(false) as any,
    );

    await expect(
      service.create(
        { campaignId: campaignId as any, photoUrl: 'x' } as any,
        currentUser,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lists delivery proofs', async () => {
    const deliveryProofModel = createDeliveryProofModelMock({
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            {
              _id: 'proof-1',
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
            },
          ]),
        }),
      }),
    });
    const service = new DeliveryProofsService(
      deliveryProofModel as any,
      createCampaignModelMock(null) as any,
      createStaffMembershipModelMock(false) as any,
    );

    const result = await service.findAll();

    expect(result).toEqual([expect.objectContaining({ id: 'proof-1' })]);
  });

  it('returns null when a delivery proof is not found', async () => {
    const service = new DeliveryProofsService(
      createDeliveryProofModelMock() as any,
      createCampaignModelMock(null) as any,
      createStaffMembershipModelMock(false) as any,
    );

    const result = await service.findOne('proof-1');

    expect(result).toBeNull();
  });

  it('returns the delivery proof when found', async () => {
    const deliveryProofModel = createDeliveryProofModelMock({
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'proof-1' }),
      }),
    });
    const service = new DeliveryProofsService(
      deliveryProofModel as any,
      createCampaignModelMock(null) as any,
      createStaffMembershipModelMock(false) as any,
    );

    const result = await service.findOne('proof-1');

    expect(result).toEqual(expect.objectContaining({ id: 'proof-1' }));
  });

  it('updates a delivery proof', async () => {
    const deliveryProofModel = createDeliveryProofModelMock({
      findByIdAndUpdate: jest.fn().mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: 'proof-1', description: 'updated' }),
      }),
    });
    const service = new DeliveryProofsService(
      deliveryProofModel as any,
      createCampaignModelMock(null) as any,
      createStaffMembershipModelMock(false) as any,
    );

    const result = await service.update('proof-1', {
      description: 'updated',
    } as any);

    expect(result).toEqual(expect.objectContaining({ description: 'updated' }));
  });

  it('returns null when updating a delivery proof that does not exist', async () => {
    const service = new DeliveryProofsService(
      createDeliveryProofModelMock() as any,
      createCampaignModelMock(null) as any,
      createStaffMembershipModelMock(false) as any,
    );

    const result = await service.update('proof-1', {} as any);

    expect(result).toBeNull();
  });

  it('removes a delivery proof', async () => {
    const deliveryProofModel = createDeliveryProofModelMock();
    const service = new DeliveryProofsService(
      deliveryProofModel as any,
      createCampaignModelMock(null) as any,
      createStaffMembershipModelMock(false) as any,
    );

    await service.remove('proof-1');

    expect(deliveryProofModel.findByIdAndDelete).toHaveBeenCalledWith(
      'proof-1',
    );
  });
});
