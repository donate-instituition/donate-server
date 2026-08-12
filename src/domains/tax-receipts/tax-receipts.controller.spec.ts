import { TaxReceiptsController } from './tax-receipts.controller';

function createTaxReceiptsServiceMock() {
  return {
    create: jest.fn().mockResolvedValue({ id: 'receipt-1' }),
    findAll: jest.fn().mockResolvedValue([{ id: 'receipt-1' }]),
    findOne: jest.fn().mockResolvedValue({ id: 'receipt-1' }),
    update: jest.fn().mockResolvedValue({ id: 'receipt-1' }),
    remove: jest.fn().mockResolvedValue({ id: 'receipt-1' }),
    getPdfObject: jest.fn().mockResolvedValue({
      body: { pipe: jest.fn() },
      contentLength: 1234,
      contentType: 'application/pdf',
      filename: 'ED-1.pdf',
    }),
  };
}

function createResponseMock() {
  return {
    setHeader: jest.fn(),
  };
}

describe('TaxReceiptsController', () => {
  function createController() {
    const taxReceiptsService = createTaxReceiptsServiceMock();
    const controller = new TaxReceiptsController(taxReceiptsService as any);
    return { controller, taxReceiptsService };
  }

  it('delegates create to the service', async () => {
    const { controller, taxReceiptsService } = createController();
    const dto = { receiptNumber: 'ED-1' } as any;

    const result = await controller.create(dto);

    expect(taxReceiptsService.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'receipt-1' });
  });

  it('delegates findAll to the service', async () => {
    const { controller, taxReceiptsService } = createController();

    const result = await controller.findAll();

    expect(taxReceiptsService.findAll).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'receipt-1' }]);
  });

  it('delegates findOne to the service', async () => {
    const { controller, taxReceiptsService } = createController();

    const result = await controller.findOne('receipt-1');

    expect(taxReceiptsService.findOne).toHaveBeenCalledWith('receipt-1');
    expect(result).toEqual({ id: 'receipt-1' });
  });

  it('delegates update to the service', async () => {
    const { controller, taxReceiptsService } = createController();
    const dto = { amount: 200 } as any;

    const result = await controller.update('receipt-1', dto);

    expect(taxReceiptsService.update).toHaveBeenCalledWith('receipt-1', dto);
    expect(result).toEqual({ id: 'receipt-1' });
  });

  it('delegates remove to the service', async () => {
    const { controller, taxReceiptsService } = createController();

    const result = await controller.remove('receipt-1');

    expect(taxReceiptsService.remove).toHaveBeenCalledWith('receipt-1');
    expect(result).toEqual({ id: 'receipt-1' });
  });

  describe('getPdf', () => {
    it('streams the PDF body and sets response headers from the service result', async () => {
      const { controller, taxReceiptsService } = createController();
      const response = createResponseMock();
      const pipe = jest.fn();
      taxReceiptsService.getPdfObject.mockResolvedValue({
        body: { pipe },
        contentLength: 1234,
        contentType: 'application/pdf',
        filename: 'ED-1.pdf',
      });

      await controller.getPdf('receipt-1', 'token-1', response as any);

      expect(taxReceiptsService.getPdfObject).toHaveBeenCalledWith(
        'receipt-1',
        'token-1',
      );
      expect(response.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/pdf',
      );
      expect(response.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="ED-1.pdf"',
      );
      expect(response.setHeader).toHaveBeenCalledWith(
        'Content-Length',
        '1234',
      );
      expect(pipe).toHaveBeenCalledWith(response);
    });

    it('omits the Content-Length header when the storage stream did not report one', async () => {
      const { controller, taxReceiptsService } = createController();
      const response = createResponseMock();
      taxReceiptsService.getPdfObject.mockResolvedValue({
        body: { pipe: jest.fn() },
        contentLength: undefined,
        contentType: 'application/pdf',
        filename: 'ED-1.pdf',
      });

      await controller.getPdf('receipt-1', undefined, response as any);

      expect(
        response.setHeader.mock.calls.some(
          ([header]: [string]) => header === 'Content-Length',
        ),
      ).toBe(false);
    });
  });
});
