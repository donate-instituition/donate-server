import { TrackingEventsService } from './tracking-events.service';

describe('TrackingEventsService', () => {
  const service = new TrackingEventsService();

  it('returns the dto unchanged on create', () => {
    const dto = { donationId: 'd1', eventType: 'PICKED_UP' } as any;

    expect(service.create(dto)).toBe(dto);
  });

  it('returns an empty array on findAll', () => {
    expect(service.findAll()).toEqual([]);
  });

  it('returns an object with the given id on findOne', () => {
    expect(service.findOne('event-1')).toEqual({ id: 'event-1' });
  });

  it('merges the id and dto on update', () => {
    const dto = { description: 'updated' } as any;

    expect(service.update('event-1', dto)).toEqual({
      id: 'event-1',
      description: 'updated',
    });
  });

  it('returns an object with the given id on remove', () => {
    expect(service.remove('event-1')).toEqual({ id: 'event-1' });
  });
});
