import { Injectable } from '@nestjs/common';

import { CreatePostReactionDto } from './dto/create-post-reaction.dto';
import { UpdatePostReactionDto } from './dto/update-post-reaction.dto';

@Injectable()
export class PostReactionsService {
  create(createPostReactionDto: CreatePostReactionDto) {
    return createPostReactionDto;
  }

  findAll() {
    return [];
  }

  findOne(id: string) {
    return { id };
  }

  update(id: string, updatePostReactionDto: UpdatePostReactionDto) {
    return {
      id,
      ...updatePostReactionDto,
    };
  }

  remove(id: string) {
    return { id };
  }
}
