import { Injectable } from '@nestjs/common';

import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

@Injectable()
export class ConversationsService {
  create(createConversationDto: CreateConversationDto) {
    return createConversationDto;
  }

  findAll() {
    return [];
  }

  findOne(id: string) {
    return { id };
  }

  update(id: string, updateConversationDto: UpdateConversationDto) {
    return {
      id,
      ...updateConversationDto,
    };
  }

  remove(id: string) {
    return { id };
  }
}
