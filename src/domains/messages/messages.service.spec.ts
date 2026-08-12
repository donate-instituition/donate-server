import { Types } from 'mongoose';

import { MessageType } from './models';
import { MessagesService } from './messages.service';

describe('MessagesService', () => {
  function createService() {
    return new MessagesService();
  }

  it('returns the given dto on create', () => {
    const service = createService();
    const dto = {
      conversationId: new Types.ObjectId(),
      senderUserId: new Types.ObjectId(),
      content: 'Hello',
      messageType: MessageType.TEXT,
    };

    const result = service.create(dto as any);

    expect(result).toBe(dto);
  });

  it('returns an empty array on findAll', () => {
    const service = createService();

    expect(service.findAll()).toEqual([]);
  });

  it('returns an object with the given id on findOne', () => {
    const service = createService();

    expect(service.findOne('msg-1')).toEqual({ id: 'msg-1' });
  });

  it('merges the update dto with the id on update', () => {
    const service = createService();
    const dto = { content: 'Updated content' };

    const result = service.update('msg-1', dto as any);

    expect(result).toEqual({ id: 'msg-1', content: 'Updated content' });
  });

  it('returns an object with the given id on remove', () => {
    const service = createService();

    expect(service.remove('msg-1')).toEqual({ id: 'msg-1' });
  });
});
