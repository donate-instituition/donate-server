import { UploadCategory } from './models';
import {
  buildFinalKey,
  buildTempKey,
  extensionForContentType,
  isPublicCategory,
} from './upload-key.util';

describe('buildTempKey', () => {
  it('builds a temp/ key scoped to the upload id', () => {
    expect(buildTempKey('upload-1', 'file.jpg')).toBe('temp/upload-1/file.jpg');
  });
});

describe('extensionForContentType', () => {
  it('maps pdf, png and jpeg content types', () => {
    expect(extensionForContentType('application/pdf')).toBe('pdf');
    expect(extensionForContentType('image/png')).toBe('png');
    expect(extensionForContentType('image/jpeg')).toBe('jpg');
  });
});

describe('isPublicCategory', () => {
  it('classifies avatar/logo/cover/banner/post as public', () => {
    expect(isPublicCategory(UploadCategory.USER_AVATAR)).toBe(true);
    expect(isPublicCategory(UploadCategory.INSTITUTION_LOGO)).toBe(true);
    expect(isPublicCategory(UploadCategory.INSTITUTION_COVER)).toBe(true);
    expect(isPublicCategory(UploadCategory.CAMPAIGN_BANNER)).toBe(true);
    expect(isPublicCategory(UploadCategory.POST_MEDIA)).toBe(true);
  });

  it('classifies documents/reports/proofs/attachments as private', () => {
    expect(isPublicCategory(UploadCategory.USER_DOCUMENT)).toBe(false);
    expect(isPublicCategory(UploadCategory.INSTITUTION_DOCUMENT)).toBe(false);
    expect(isPublicCategory(UploadCategory.INSTITUTION_REPORT)).toBe(false);
    expect(isPublicCategory(UploadCategory.DELIVERY_PROOF)).toBe(false);
    expect(isPublicCategory(UploadCategory.DONATION_ATTACHMENT)).toBe(false);
  });
});

describe('buildFinalKey', () => {
  it('builds the user avatar key', () => {
    expect(
      buildFinalKey(UploadCategory.USER_AVATAR, { userId: 'u1' }, 'a.jpg'),
    ).toBe('public/users/u1/avatar/a.jpg');
  });

  it('builds the user document key', () => {
    expect(
      buildFinalKey(UploadCategory.USER_DOCUMENT, { userId: 'u1' }, 'd.pdf'),
    ).toBe('private/users/u1/documents/d.pdf');
  });

  it('builds the institution logo key', () => {
    expect(
      buildFinalKey(
        UploadCategory.INSTITUTION_LOGO,
        { institutionId: 'i1' },
        'l.png',
      ),
    ).toBe('public/institutions/i1/logo/l.png');
  });

  it('builds the institution cover key', () => {
    expect(
      buildFinalKey(
        UploadCategory.INSTITUTION_COVER,
        { institutionId: 'i1' },
        'c.png',
      ),
    ).toBe('public/institutions/i1/cover/c.png');
  });

  it('builds the institution document key', () => {
    expect(
      buildFinalKey(
        UploadCategory.INSTITUTION_DOCUMENT,
        { institutionId: 'i1' },
        'd.pdf',
      ),
    ).toBe('private/institutions/i1/documents/d.pdf');
  });

  it('builds the institution report key', () => {
    expect(
      buildFinalKey(
        UploadCategory.INSTITUTION_REPORT,
        { institutionId: 'i1' },
        'r.pdf',
      ),
    ).toBe('private/institutions/i1/reports/r.pdf');
  });

  it('builds the campaign banner key nested under the institution', () => {
    expect(
      buildFinalKey(
        UploadCategory.CAMPAIGN_BANNER,
        { campaignId: 'c1', institutionId: 'i1' },
        'b.jpg',
      ),
    ).toBe('public/institutions/i1/campaigns/c1/b.jpg');
  });

  it('builds the delivery proof key scoped to the campaign', () => {
    expect(
      buildFinalKey(
        UploadCategory.DELIVERY_PROOF,
        { campaignId: 'c1' },
        'p.pdf',
      ),
    ).toBe('private/campaigns/c1/proofs/p.pdf');
  });

  it('builds the donation attachment key', () => {
    expect(
      buildFinalKey(
        UploadCategory.DONATION_ATTACHMENT,
        { donationId: 'd1' },
        'a.pdf',
      ),
    ).toBe('private/donations/d1/attachments/a.pdf');
  });

  it('builds an institution post media key when institutionId is present', () => {
    expect(
      buildFinalKey(
        UploadCategory.POST_MEDIA,
        { institutionId: 'i1', postId: 'p1' },
        'm.jpg',
      ),
    ).toBe('public/institutions/i1/posts/p1/m.jpg');
  });

  it('builds a donor post media key when institutionId is absent', () => {
    expect(
      buildFinalKey(
        UploadCategory.POST_MEDIA,
        { postId: 'p1', userId: 'u1' },
        'm.jpg',
      ),
    ).toBe('public/users/u1/posts/p1/m.jpg');
  });

  it('throws when a required param is missing', () => {
    expect(() =>
      buildFinalKey(UploadCategory.USER_AVATAR, {}, 'a.jpg'),
    ).toThrow('userId is required');
  });
});
