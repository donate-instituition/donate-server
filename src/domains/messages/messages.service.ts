import { Injectable } from '@nestjs/common';

import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

@Injectable()
export class MessagesService {
  create(createMessageDto: CreateMessageDto) {
    return createMessageDto;
  }

  findAll() {
    return [];
  }

  findOne(id: string) {
    return { id };
  }

  update(id: string, updateMessageDto: UpdateMessageDto) {
    return {
      id,
      ...updateMessageDto,
    };
  }

  remove(id: string) {
    return { id };
  }
}
