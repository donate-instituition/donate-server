import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  const service = new ReportsService();

  it('returns the dto unchanged on create', () => {
    const dto = { reporterUserId: 'u1', targetType: 'POST' } as any;

    expect(service.create(dto)).toBe(dto);
  });

  it('returns an empty array on findAll', () => {
    expect(service.findAll()).toEqual([]);
  });

  it('returns an object with the given id on findOne', () => {
    expect(service.findOne('report-1')).toEqual({ id: 'report-1' });
  });

  it('merges the id and dto on update', () => {
    const dto = { status: 'RESOLVED' } as any;

    expect(service.update('report-1', dto)).toEqual({
      id: 'report-1',
      status: 'RESOLVED',
    });
  });

  it('returns an object with the given id on remove', () => {
    expect(service.remove('report-1')).toEqual({ id: 'report-1' });
  });
});
