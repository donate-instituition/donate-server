import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  function createService() {
    return new CategoriesService();
  }

  it('create() echoes back the provided dto', () => {
    const service = createService();
    const dto = { type: 'FOOD', name: 'Alimentos', slug: 'alimentos' } as any;

    const result = service.create(dto);

    expect(result).toBe(dto);
  });

  it('findAll() returns an empty list', () => {
    const service = createService();

    const result = service.findAll();

    expect(result).toEqual([]);
  });

  it('findOne() returns an object with the given id', () => {
    const service = createService();

    const result = service.findOne('cat-1');

    expect(result).toEqual({ id: 'cat-1' });
  });

  it('update() merges the id with the update dto', () => {
    const service = createService();
    const dto = { name: 'Novo nome' } as any;

    const result = service.update('cat-1', dto);

    expect(result).toEqual({ id: 'cat-1', name: 'Novo nome' });
  });

  it('remove() returns an object with the given id', () => {
    const service = createService();

    const result = service.remove('cat-1');

    expect(result).toEqual({ id: 'cat-1' });
  });
});
