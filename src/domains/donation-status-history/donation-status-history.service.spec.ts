import { DonationStatusHistoryService } from './donation-status-history.service';

describe('DonationStatusHistoryService', () => {
  const service = new DonationStatusHistoryService();

  it('returns the dto unchanged on create', () => {
    const dto = { donationId: 'd1', toStatus: 'PAID' } as any;

    expect(service.create(dto)).toBe(dto);
  });

  it('returns an empty array on findAll', () => {
    expect(service.findAll()).toEqual([]);
  });

  it('returns an object with the given id on findOne', () => {
    expect(service.findOne('history-1')).toEqual({ id: 'history-1' });
  });

  it('merges the id and dto on update', () => {
    const dto = { note: 'updated' } as any;

    expect(service.update('history-1', dto)).toEqual({
      id: 'history-1',
      note: 'updated',
    });
  });

  it('returns an object with the given id on remove', () => {
    expect(service.remove('history-1')).toEqual({ id: 'history-1' });
  });
});
