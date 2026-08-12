import { UploadCategory } from './models';
import { UploadsController } from './uploads.controller';

function createUser(overrides: Record<string, unknown> = {}) {
  return {
    sub: 'user-1',
    email: 'donor@example.com',
    roles: [],
    ...overrides,
  } as any;
}

describe('UploadsController', () => {
  let uploadsService: {
    confirmUpload: jest.Mock;
    createUpload: jest.Mock;
    getPrivateDownloadUrl: jest.Mock;
    getPublicDownloadUrl: jest.Mock;
  };

  function createController() {
    return new UploadsController(uploadsService as any);
  }

  beforeEach(() => {
    uploadsService = {
      confirmUpload: jest.fn(),
      createUpload: jest.fn(),
      getPrivateDownloadUrl: jest.fn(),
      getPublicDownloadUrl: jest.fn(),
    };
  });

  describe('createUpload', () => {
    it('delegates to the service and returns its result', () => {
      uploadsService.createUpload.mockReturnValue({ uploadId: 'u1' });
      const controller = createController();
      const dto = {
        base64: 'ZGF0YQ==',
        category: UploadCategory.USER_AVATAR,
        contentType: 'image/jpeg',
        filename: 'a.jpg',
      };

      const result = controller.createUpload(dto);

      expect(uploadsService.createUpload).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ uploadId: 'u1' });
    });
  });

  describe('confirmUpload', () => {
    it('rewrites a relative url into an absolute one using the request host', async () => {
      uploadsService.confirmUpload.mockResolvedValue({
        key: 'public/users/u1/avatar/a.jpg',
        url: '/uploads/public?key=public%2Fusers%2Fu1%2Favatar%2Fa.jpg',
      });
      const controller = createController();
      const user = createUser();
      const dto = { category: UploadCategory.USER_AVATAR, fileName: 'a.jpg' };
      const request = {
        protocol: 'https',
        get: jest.fn().mockReturnValue('api.example.com'),
      } as any;

      const result = await controller.confirmUpload(
        'upload-1',
        dto,
        user,
        request,
      );

      expect(uploadsService.confirmUpload).toHaveBeenCalledWith(
        'upload-1',
        dto,
        user,
      );
      expect(request.get).toHaveBeenCalledWith('host');
      expect(result).toEqual({
        key: 'public/users/u1/avatar/a.jpg',
        url: 'https://api.example.com/uploads/public?key=public%2Fusers%2Fu1%2Favatar%2Fa.jpg',
      });
    });

    it('returns the confirmed upload unchanged when it has no url', async () => {
      uploadsService.confirmUpload.mockResolvedValue({
        key: 'private/campaigns/c1/proofs/p.pdf',
      });
      const controller = createController();
      const request = {
        protocol: 'https',
        get: jest.fn(),
      } as any;

      const result = await controller.confirmUpload(
        'upload-1',
        { category: UploadCategory.DELIVERY_PROOF, fileName: 'p.pdf' },
        createUser(),
        request,
      );

      expect(request.get).not.toHaveBeenCalled();
      expect(result).toEqual({ key: 'private/campaigns/c1/proofs/p.pdf' });
    });
  });

  describe('getPublicObject', () => {
    it('sends the file directly when the download url is an absolute path', async () => {
      uploadsService.getPublicDownloadUrl.mockResolvedValue('/var/data/a.jpg');
      const controller = createController();
      const response = {
        sendFile: jest.fn(),
        redirect: jest.fn(),
      } as any;

      await controller.getPublicObject('public/a.jpg', response);

      expect(uploadsService.getPublicDownloadUrl).toHaveBeenCalledWith(
        'public/a.jpg',
      );
      expect(response.sendFile).toHaveBeenCalledWith('/var/data/a.jpg');
      expect(response.redirect).not.toHaveBeenCalled();
    });

    it('redirects when the download url is not an absolute path', async () => {
      uploadsService.getPublicDownloadUrl.mockResolvedValue(
        'https://cdn.example.com/a.jpg?sig=x',
      );
      const controller = createController();
      const response = {
        sendFile: jest.fn(),
        redirect: jest.fn(),
      } as any;

      await controller.getPublicObject('public/a.jpg', response);

      expect(response.redirect).toHaveBeenCalledWith(
        'https://cdn.example.com/a.jpg?sig=x',
      );
      expect(response.sendFile).not.toHaveBeenCalled();
    });
  });

  describe('getPrivateObject', () => {
    it('sends the file directly when the download url is an absolute path', async () => {
      uploadsService.getPrivateDownloadUrl.mockResolvedValue(
        '/var/data/private/a.jpg',
      );
      const controller = createController();
      const response = {
        sendFile: jest.fn(),
        redirect: jest.fn(),
      } as any;
      const user = createUser();

      await controller.getPrivateObject('private/a.jpg', user, response);

      expect(uploadsService.getPrivateDownloadUrl).toHaveBeenCalledWith(
        'private/a.jpg',
        user,
      );
      expect(response.sendFile).toHaveBeenCalledWith('/var/data/private/a.jpg');
    });

    it('redirects when the download url is not an absolute path', async () => {
      uploadsService.getPrivateDownloadUrl.mockResolvedValue(
        'https://cdn.example.com/private/a.jpg?sig=x',
      );
      const controller = createController();
      const response = {
        sendFile: jest.fn(),
        redirect: jest.fn(),
      } as any;

      await controller.getPrivateObject(
        'private/a.jpg',
        createUser(),
        response,
      );

      expect(response.redirect).toHaveBeenCalledWith(
        'https://cdn.example.com/private/a.jpg?sig=x',
      );
      expect(response.sendFile).not.toHaveBeenCalled();
    });
  });
});
