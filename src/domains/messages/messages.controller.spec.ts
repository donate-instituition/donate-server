import { MessagesController } from './messages.controller';

describe('MessagesController', () => {
  function createController() {
    const messagesService = {
      create: jest.fn().mockReturnValue({ id: 'msg-1' }),
      findAll: jest.fn().mockReturnValue([]),
      findOne: jest.fn().mockReturnValue({ id: 'msg-1' }),
      update: jest.fn().mockReturnValue({ id: 'msg-1' }),
      remove: jest.fn().mockReturnValue({ id: 'msg-1' }),
    };
    const controller = new MessagesController(messagesService as any);

    return { controller, messagesService };
  }

  it('delegates create to the service', () => {
    const { controller, messagesService } = createController();
    const dto = { content: 'hi' };

    const result = controller.create(dto as any);

    expect(messagesService.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'msg-1' });
  });

  it('delegates findAll to the service', () => {
    const { controller, messagesService } = createController();

    const result = controller.findAll();

    expect(messagesService.findAll).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('delegates findOne to the service', () => {
    const { controller, messagesService } = createController();

    const result = controller.findOne('msg-1');

    expect(messagesService.findOne).toHaveBeenCalledWith('msg-1');
    expect(result).toEqual({ id: 'msg-1' });
  });

  it('delegates update to the service', () => {
    const { controller, messagesService } = createController();
    const dto = { content: 'updated' };

    const result = controller.update('msg-1', dto as any);

    expect(messagesService.update).toHaveBeenCalledWith('msg-1', dto);
    expect(result).toEqual({ id: 'msg-1' });
  });

  it('delegates remove to the service', () => {
    const { controller, messagesService } = createController();

    const result = controller.remove('msg-1');

    expect(messagesService.remove).toHaveBeenCalledWith('msg-1');
    expect(result).toEqual({ id: 'msg-1' });
  });
});
