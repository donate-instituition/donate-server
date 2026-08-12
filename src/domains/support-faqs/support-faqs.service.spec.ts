import { NotFoundException } from '@nestjs/common';

import { SupportFaqsService } from './support-faqs.service';

function createSupportFaqModelMock(overrides: Partial<Record<string, any>> = {}) {
  return {
    create: jest.fn().mockResolvedValue({ _id: 'faq-1', isCurrent: false }),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
    }),
    findOne: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    }),
    findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    findByIdAndDelete: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    updateMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    ...overrides,
  };
}

describe('SupportFaqsService', () => {
  it('throws BadRequestException when the version is blank', async () => {
    const service = new SupportFaqsService(createSupportFaqModelMock() as any);

    await expect(
      service.create({
        version: '  ',
        items: [{ question: 'Q', answer: 'A' }],
      } as any),
    ).rejects.toThrow('Support FAQ version is required');
  });

  it('throws BadRequestException when there are no items', async () => {
    const service = new SupportFaqsService(createSupportFaqModelMock() as any);

    await expect(
      service.create({ version: '1.0', items: [] } as any),
    ).rejects.toThrow('Support FAQ items are required');
  });

  it('filters out incomplete items and sorts by order', async () => {
    const supportFaqModel = createSupportFaqModelMock();
    const service = new SupportFaqsService(supportFaqModel as any);

    await service.create({
      version: '1.0',
      items: [
        { question: 'Q2', answer: 'A2', order: 2 },
        { question: '', answer: 'A1', order: 1 },
        { question: 'Q0', answer: 'A0', order: 0 },
      ],
    } as any);

    const [payload] = supportFaqModel.create.mock.calls[0];
    expect(payload.items).toEqual([
      { question: 'Q0', answer: 'A0', order: 0 },
      { question: 'Q2', answer: 'A2', order: 2 },
    ]);
  });

  it('falls back to a default title when none is given', async () => {
    const supportFaqModel = createSupportFaqModelMock();
    const service = new SupportFaqsService(supportFaqModel as any);

    await service.create({
      version: '1.0',
      items: [{ question: 'Q', answer: 'A' }],
    } as any);

    const [payload] = supportFaqModel.create.mock.calls[0];
    expect(payload.title).toBe('Perguntas frequentes');
  });

  it('sets other faqs as not current when the new one is current', async () => {
    const supportFaqModel = createSupportFaqModelMock({
      create: jest
        .fn()
        .mockResolvedValue({ _id: 'faq-1', isCurrent: true }),
    });
    const service = new SupportFaqsService(supportFaqModel as any);

    await service.create({
      version: '1.0',
      isCurrent: true,
      items: [{ question: 'Q', answer: 'A' }],
    } as any);

    expect(supportFaqModel.updateMany).toHaveBeenCalledWith(
      { _id: { $ne: 'faq-1' } },
      { $set: { isCurrent: false } },
    );
  });

  it('does not touch other faqs when the new one is not current', async () => {
    const supportFaqModel = createSupportFaqModelMock();
    const service = new SupportFaqsService(supportFaqModel as any);

    await service.create({
      version: '1.0',
      items: [{ question: 'Q', answer: 'A' }],
    } as any);

    expect(supportFaqModel.updateMany).not.toHaveBeenCalled();
  });

  it('lists support faqs sorted by createdAt', async () => {
    const supportFaqModel = createSupportFaqModelMock();
    const service = new SupportFaqsService(supportFaqModel as any);

    await service.findAll();

    const sortMock = supportFaqModel.find.mock.results[0].value.sort;
    expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it('throws NotFoundException when there is no current faq', async () => {
    const service = new SupportFaqsService(createSupportFaqModelMock() as any);

    await expect(service.findCurrent()).rejects.toThrow(NotFoundException);
  });

  it('returns the current faq when found', async () => {
    const supportFaqModel = createSupportFaqModelMock({
      findOne: jest.fn().mockReturnValue({
        sort: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: 'faq-1' }) }),
      }),
    });
    const service = new SupportFaqsService(supportFaqModel as any);

    const result = await service.findCurrent();

    expect(result).toEqual({ _id: 'faq-1' });
  });

  it('throws NotFoundException when findOne does not find a faq', async () => {
    const service = new SupportFaqsService(createSupportFaqModelMock() as any);

    await expect(service.findOne('faq-1')).rejects.toThrow(NotFoundException);
  });

  it('returns the faq when findOne finds it', async () => {
    const supportFaqModel = createSupportFaqModelMock({
      findById: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: 'faq-1' }) }),
    });
    const service = new SupportFaqsService(supportFaqModel as any);

    const result = await service.findOne('faq-1');

    expect(result).toEqual({ _id: 'faq-1' });
  });

  it('throws NotFoundException when updating a faq that does not exist', async () => {
    const service = new SupportFaqsService(createSupportFaqModelMock() as any);

    await expect(
      service.update('faq-1', { title: 'New' } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('updates the given fields, saves, and republishes when becoming current', async () => {
    const existing: Record<string, any> = {
      _id: 'faq-1',
      title: 'Old',
      version: '1.0',
      items: [],
      isCurrent: false,
      publishedAt: undefined,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const supportFaqModel = createSupportFaqModelMock({
      findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) }),
    });
    const service = new SupportFaqsService(supportFaqModel as any);

    const result = await service.update('faq-1', {
      title: '  New Title  ',
      version: ' 2.0 ',
      items: [{ question: 'Q', answer: 'A', order: 0 }],
      isCurrent: true,
    } as any);

    expect(existing.title).toBe('New Title');
    expect(existing.version).toBe('2.0');
    expect(existing.items).toEqual([{ question: 'Q', answer: 'A', order: 0 }]);
    expect(existing.isCurrent).toBe(true);
    expect(existing.publishedAt).toBeInstanceOf(Date);
    expect(existing.save).toHaveBeenCalled();
    expect(supportFaqModel.updateMany).toHaveBeenCalledWith(
      { _id: { $ne: 'faq-1' } },
      { $set: { isCurrent: false } },
    );
    expect(result).toBe(existing);
  });

  it('keeps the previous publishedAt when isCurrent is set to false', async () => {
    const previousDate = new Date('2025-01-01T00:00:00.000Z');
    const existing: Record<string, any> = {
      _id: 'faq-1',
      title: 'Old',
      version: '1.0',
      items: [],
      isCurrent: true,
      publishedAt: previousDate,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const supportFaqModel = createSupportFaqModelMock({
      findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) }),
    });
    const service = new SupportFaqsService(supportFaqModel as any);

    await service.update('faq-1', { isCurrent: false } as any);

    expect(existing.isCurrent).toBe(false);
    expect(existing.publishedAt).toBe(previousDate);
    expect(supportFaqModel.updateMany).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when removing a faq that does not exist', async () => {
    const service = new SupportFaqsService(createSupportFaqModelMock() as any);

    await expect(service.remove('faq-1')).rejects.toThrow(NotFoundException);
  });

  it('removes the faq and returns its id', async () => {
    const supportFaqModel = createSupportFaqModelMock({
      findByIdAndDelete: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: 'faq-1' }) }),
    });
    const service = new SupportFaqsService(supportFaqModel as any);

    const result = await service.remove('faq-1');

    expect(result).toEqual({ id: 'faq-1' });
  });
});
