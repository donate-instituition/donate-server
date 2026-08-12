import { NotFoundException } from '@nestjs/common';

import { TermsService } from './terms.service';

function createTermModelMock(overrides: Partial<Record<string, any>> = {}) {
  return {
    create: jest
      .fn()
      .mockResolvedValue({ _id: 'term-1', isCurrent: false, version: '1.0' }),
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

function createUsersServiceMock() {
  return {
    acceptTerms: jest.fn().mockResolvedValue({}),
    markTermsPendingForVersionChange: jest.fn().mockResolvedValue({}),
  };
}

describe('TermsService', () => {
  it('throws BadRequestException when the version is blank', async () => {
    const service = new TermsService(
      createTermModelMock() as any,
      createUsersServiceMock() as any,
    );

    await expect(
      service.create({ version: '  ', content: 'body' } as any),
    ).rejects.toThrow('Term version is required');
  });

  it('throws BadRequestException when the content is blank', async () => {
    const service = new TermsService(
      createTermModelMock() as any,
      createUsersServiceMock() as any,
    );

    await expect(
      service.create({ version: '1.0', content: '  ' } as any),
    ).rejects.toThrow('Term content is required');
  });

  it('falls back to a default title when none is given', async () => {
    const termModel = createTermModelMock();
    const service = new TermsService(
      termModel as any,
      createUsersServiceMock() as any,
    );

    await service.create({ version: '1.0', content: 'body' } as any);

    const [payload] = termModel.create.mock.calls[0];
    expect(payload.title).toBe('Termos de Uso e Política de Privacidade');
  });

  it('republishes and marks users pending when the new term is current', async () => {
    const termModel = createTermModelMock({
      create: jest
        .fn()
        .mockResolvedValue({ _id: 'term-1', isCurrent: true, version: '1.0' }),
    });
    const usersService = createUsersServiceMock();
    const service = new TermsService(termModel as any, usersService as any);

    await service.create({
      version: '1.0',
      content: 'body',
      isCurrent: true,
    } as any);

    expect(termModel.updateMany).toHaveBeenCalledWith(
      { _id: { $ne: 'term-1' } },
      { $set: { isCurrent: false } },
    );
    expect(usersService.markTermsPendingForVersionChange).toHaveBeenCalled();
  });

  it('does not republish when the new term is not current', async () => {
    const termModel = createTermModelMock();
    const usersService = createUsersServiceMock();
    const service = new TermsService(termModel as any, usersService as any);

    await service.create({ version: '1.0', content: 'body' } as any);

    expect(termModel.updateMany).not.toHaveBeenCalled();
    expect(usersService.markTermsPendingForVersionChange).not.toHaveBeenCalled();
  });

  it('lists terms sorted by createdAt', async () => {
    const termModel = createTermModelMock();
    const service = new TermsService(
      termModel as any,
      createUsersServiceMock() as any,
    );

    await service.findAll();

    const sortMock = termModel.find.mock.results[0].value.sort;
    expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it('throws NotFoundException when there is no current term', async () => {
    const service = new TermsService(
      createTermModelMock() as any,
      createUsersServiceMock() as any,
    );

    await expect(service.findCurrent()).rejects.toThrow(NotFoundException);
  });

  it('returns the current term when found', async () => {
    const termModel = createTermModelMock({
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest
            .fn()
            .mockResolvedValue({ _id: 'term-1', version: '1.0' }),
        }),
      }),
    });
    const service = new TermsService(
      termModel as any,
      createUsersServiceMock() as any,
    );

    const result = await service.findCurrent();

    expect(result).toEqual({ _id: 'term-1', version: '1.0' });
  });

  it('throws NotFoundException when findOne does not find a term', async () => {
    const service = new TermsService(
      createTermModelMock() as any,
      createUsersServiceMock() as any,
    );

    await expect(service.findOne('term-1')).rejects.toThrow(NotFoundException);
  });

  it('returns the term when findOne finds it', async () => {
    const termModel = createTermModelMock({
      findById: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: 'term-1' }) }),
    });
    const service = new TermsService(
      termModel as any,
      createUsersServiceMock() as any,
    );

    const result = await service.findOne('term-1');

    expect(result).toEqual({ _id: 'term-1' });
  });

  it('throws NotFoundException when updating a term that does not exist', async () => {
    const service = new TermsService(
      createTermModelMock() as any,
      createUsersServiceMock() as any,
    );

    await expect(
      service.update('term-1', { title: 'New' } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('updates the given fields, saves, and republishes when becoming current', async () => {
    const existing: Record<string, any> = {
      _id: 'term-1',
      title: 'Old',
      version: '1.0',
      content: 'old body',
      isCurrent: false,
      publishedAt: undefined,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const termModel = createTermModelMock({
      findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) }),
    });
    const usersService = createUsersServiceMock();
    const service = new TermsService(termModel as any, usersService as any);

    const result = await service.update('term-1', {
      title: '  New Title  ',
      version: ' 2.0 ',
      content: 'new body',
      isCurrent: true,
    } as any);

    expect(existing.title).toBe('New Title');
    expect(existing.version).toBe('2.0');
    expect(existing.content).toBe('new body');
    expect(existing.isCurrent).toBe(true);
    expect(existing.publishedAt).toBeInstanceOf(Date);
    expect(existing.save).toHaveBeenCalled();
    expect(termModel.updateMany).toHaveBeenCalled();
    expect(usersService.markTermsPendingForVersionChange).toHaveBeenCalled();
    expect(result).toBe(existing);
  });

  it('keeps the previous publishedAt when isCurrent is set to false', async () => {
    const previousDate = new Date('2025-01-01T00:00:00.000Z');
    const existing: Record<string, any> = {
      _id: 'term-1',
      title: 'Old',
      version: '1.0',
      content: 'body',
      isCurrent: true,
      publishedAt: previousDate,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const termModel = createTermModelMock({
      findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) }),
    });
    const service = new TermsService(
      termModel as any,
      createUsersServiceMock() as any,
    );

    await service.update('term-1', { isCurrent: false } as any);

    expect(existing.isCurrent).toBe(false);
    expect(existing.publishedAt).toBe(previousDate);
    expect(termModel.updateMany).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when removing a term that does not exist', async () => {
    const service = new TermsService(
      createTermModelMock() as any,
      createUsersServiceMock() as any,
    );

    await expect(service.remove('term-1')).rejects.toThrow(NotFoundException);
  });

  it('removes the term and returns its id', async () => {
    const termModel = createTermModelMock({
      findByIdAndDelete: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: 'term-1' }) }),
    });
    const service = new TermsService(
      termModel as any,
      createUsersServiceMock() as any,
    );

    const result = await service.remove('term-1');

    expect(result).toEqual({ id: 'term-1' });
  });

  it('accepts the current term for a user', async () => {
    const termModel = createTermModelMock({
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest
            .fn()
            .mockResolvedValue({ _id: 'term-1', version: '2.0' }),
        }),
      }),
    });
    const usersService = createUsersServiceMock();
    const service = new TermsService(termModel as any, usersService as any);

    const result = await service.acceptCurrent('user-1');

    expect(usersService.acceptTerms).toHaveBeenCalledWith('user-1', '2.0');
    expect(result).toEqual(
      expect.objectContaining({
        acceptedTermsVersion: '2.0',
        termsAccepted: true,
      }),
    );
    expect(typeof result.termsAcceptedAt).toBe('string');
  });

  it('propagates NotFoundException from acceptCurrent when there is no current term', async () => {
    const usersService = createUsersServiceMock();
    const service = new TermsService(
      createTermModelMock() as any,
      usersService as any,
    );

    await expect(service.acceptCurrent('user-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(usersService.acceptTerms).not.toHaveBeenCalled();
  });
});
