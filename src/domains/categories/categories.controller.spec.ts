import { CategoriesController } from './categories.controller';

function createCategoriesServiceMock() {
  return {
    create: jest.fn().mockReturnValue({ id: 'created' }),
    findAll: jest.fn().mockReturnValue([{ id: '1' }]),
    findOne: jest.fn().mockReturnValue({ id: '1' }),
    update: jest.fn().mockReturnValue({ id: '1', name: 'updated' }),
    remove: jest.fn().mockReturnValue({ id: '1' }),
  };
}

describe('CategoriesController', () => {
  function createController() {
    const categoriesService = createCategoriesServiceMock();
    const controller = new CategoriesController(categoriesService as any);
    return { controller, categoriesService };
  }

  it('create() delegates to categoriesService.create with the dto', () => {
    const { controller, categoriesService } = createController();
    const dto = { type: 'FOOD', name: 'Alimentos', slug: 'alimentos' } as any;

    const result = controller.create(dto);

    expect(categoriesService.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'created' });
  });

  it('findAll() delegates to categoriesService.findAll', () => {
    const { controller, categoriesService } = createController();

    const result = controller.findAll();

    expect(categoriesService.findAll).toHaveBeenCalled();
    expect(result).toEqual([{ id: '1' }]);
  });

  it('findOne() delegates with the given id', () => {
    const { controller, categoriesService } = createController();

    const result = controller.findOne('cat-1');

    expect(categoriesService.findOne).toHaveBeenCalledWith('cat-1');
    expect(result).toEqual({ id: '1' });
  });

  it('update() delegates with the id and dto', () => {
    const { controller, categoriesService } = createController();
    const dto = { name: 'updated' } as any;

    const result = controller.update('cat-1', dto);

    expect(categoriesService.update).toHaveBeenCalledWith('cat-1', dto);
    expect(result).toEqual({ id: '1', name: 'updated' });
  });

  it('remove() delegates with the given id', () => {
    const { controller, categoriesService } = createController();

    const result = controller.remove('cat-1');

    expect(categoriesService.remove).toHaveBeenCalledWith('cat-1');
    expect(result).toEqual({ id: '1' });
  });
});
