import { TaxReceiptType } from './models';
import { TaxReceiptsService } from './tax-receipts.service';

describe('TaxReceiptsService', () => {
  function createModel() {
    return {
      create: jest.fn().mockResolvedValue({ _id: 'receipt-1' }),
      find: jest.fn().mockReturnValue({
        sort: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
      }),
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
      findByIdAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
      findByIdAndDelete: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    };
  }

  function createObjectStorage() {
    return {
      getObjectStream: jest.fn().mockResolvedValue({
        body: { pipe: jest.fn() },
        contentLength: 1234,
        contentType: 'application/pdf',
      }),
    };
  }

  function createService(overrides: {
    taxReceiptModel?: ReturnType<typeof createModel>;
    objectStorage?: ReturnType<typeof createObjectStorage>;
  } = {}) {
    const taxReceiptModel = overrides.taxReceiptModel ?? createModel();
    const objectStorage = overrides.objectStorage ?? createObjectStorage();
    const service = new TaxReceiptsService(
      taxReceiptModel as any,
      objectStorage as any,
    );
    return { service, taxReceiptModel, objectStorage };
  }

  describe('createPdfDownloadPath', () => {
    it('builds a path containing an encoded, verifiable token', () => {
      const path = TaxReceiptsService.createPdfDownloadPath('receipt-1');

      expect(path).toMatch(/^\/tax-receipts\/receipt-1\/pdf\?token=/);

      const token = decodeURIComponent(path.split('token=')[1]);
      const { taxReceiptModel, objectStorage, service } = createService();
      taxReceiptModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'receipt-1',
          receiptNumber: 'ED-1',
          metadata: { storageObjectKey: 'key-1' },
        }),
      });

      return expect(
        service.getPdfObject('receipt-1', token),
      ).resolves.toEqual(
        expect.objectContaining({ filename: 'ED-1.pdf' }),
      );
    });

    it('produces different tokens for different receipt ids', () => {
      const pathA = TaxReceiptsService.createPdfDownloadPath('receipt-a');
      const pathB = TaxReceiptsService.createPdfDownloadPath('receipt-b');

      expect(pathA).not.toEqual(pathB);
    });
  });

  describe('basic CRUD', () => {
    it('creates a tax receipt', async () => {
      const { service, taxReceiptModel } = createService();
      const dto = {
        donationId: 'don-1',
        donorUserId: 'user-1',
        institutionId: 'inst-1',
        receiptNumber: 'ED-1',
        type: TaxReceiptType.DONATION_RECEIPT,
        amount: 100,
        issuedAt: new Date(),
      } as any;

      await service.create(dto);

      expect(taxReceiptModel.create).toHaveBeenCalledWith(dto);
    });

    it('finds all receipts sorted by issuedAt desc', async () => {
      const { service, taxReceiptModel } = createService();

      const result = await service.findAll();

      expect(taxReceiptModel.find).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('throws NotFoundException when a receipt does not exist', async () => {
      const { service } = createService();

      await expect(service.findOne('missing')).rejects.toThrow(
        'Tax receipt not found',
      );
    });

    it('returns the receipt when it exists', async () => {
      const { service, taxReceiptModel } = createService();
      taxReceiptModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'receipt-1' }),
      });

      const result = await service.findOne('receipt-1');

      expect(result).toEqual({ _id: 'receipt-1' });
    });

    it('updates a receipt', async () => {
      const { service, taxReceiptModel } = createService();

      await service.update('receipt-1', { amount: 200 } as any);

      expect(taxReceiptModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'receipt-1',
        { amount: 200 },
        { returnDocument: 'after' },
      );
    });

    it('removes a receipt', async () => {
      const { service, taxReceiptModel } = createService();

      await service.remove('receipt-1');

      expect(taxReceiptModel.findByIdAndDelete).toHaveBeenCalledWith(
        'receipt-1',
      );
    });
  });

  describe('getPdfObject', () => {
    it('throws ForbiddenException when no token is provided', async () => {
      const { service } = createService();

      await expect(service.getPdfObject('receipt-1', undefined)).rejects.toThrow(
        'Receipt download token is required.',
      );
    });

    it('throws ForbiddenException when the token is invalid', async () => {
      const { service } = createService();

      await expect(
        service.getPdfObject('receipt-1', 'not-the-right-token'),
      ).rejects.toThrow('Invalid receipt download token.');
    });

    it('throws ForbiddenException when the token was signed for a different receipt', async () => {
      const { service } = createService();
      const tokenForOtherReceipt = decodeURIComponent(
        TaxReceiptsService.createPdfDownloadPath('other-receipt').split(
          'token=',
        )[1],
      );

      await expect(
        service.getPdfObject('receipt-1', tokenForOtherReceipt),
      ).rejects.toThrow('Invalid receipt download token.');
    });

    it('throws NotFoundException when the receipt does not exist', async () => {
      const { service } = createService();
      const token = decodeURIComponent(
        TaxReceiptsService.createPdfDownloadPath('receipt-1').split(
          'token=',
        )[1],
      );

      await expect(service.getPdfObject('receipt-1', token)).rejects.toThrow(
        'Tax receipt not found',
      );
    });

    it('throws NotFoundException when the PDF has not been generated yet', async () => {
      const { service, taxReceiptModel } = createService();
      taxReceiptModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'receipt-1',
          receiptNumber: 'ED-1',
          metadata: {},
        }),
      });
      const token = decodeURIComponent(
        TaxReceiptsService.createPdfDownloadPath('receipt-1').split(
          'token=',
        )[1],
      );

      await expect(service.getPdfObject('receipt-1', token)).rejects.toThrow(
        'Tax receipt PDF not generated yet',
      );
    });

    it('returns the PDF stream with content type and filename resolved from storage', async () => {
      const { service, taxReceiptModel, objectStorage } = createService();
      taxReceiptModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'receipt-1',
          receiptNumber: 'ED-2026-00000001',
          metadata: { storageObjectKey: 'receipts/receipt-1.pdf' },
        }),
      });
      const token = decodeURIComponent(
        TaxReceiptsService.createPdfDownloadPath('receipt-1').split(
          'token=',
        )[1],
      );

      const result = await service.getPdfObject('receipt-1', token);

      expect(objectStorage.getObjectStream).toHaveBeenCalledWith(
        'receipts/receipt-1.pdf',
      );
      expect(result).toEqual(
        expect.objectContaining({
          contentLength: 1234,
          contentType: 'application/pdf',
          filename: 'ED-2026-00000001.pdf',
        }),
      );
    });

    it('falls back to the metadata content type when the storage stream has none', async () => {
      const { service, taxReceiptModel, objectStorage } = createService();
      objectStorage.getObjectStream.mockResolvedValue({
        body: { pipe: jest.fn() },
        contentLength: 10,
        contentType: undefined,
      });
      taxReceiptModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'receipt-1',
          receiptNumber: 'ED-1',
          metadata: {
            storageObjectKey: 'receipts/receipt-1.pdf',
            storageContentType: 'application/octet-stream',
          },
        }),
      });
      const token = decodeURIComponent(
        TaxReceiptsService.createPdfDownloadPath('receipt-1').split(
          'token=',
        )[1],
      );

      const result = await service.getPdfObject('receipt-1', token);

      expect(result.contentType).toBe('application/octet-stream');
    });
  });
});
