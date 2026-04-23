import { Injectable } from '@nestjs/common';

import { CreatePostCommentDto } from './dto/create-post-comment.dto';
import { UpdatePostCommentDto } from './dto/update-post-comment.dto';

@Injectable()
export class PostCommentsService {
  create(createPostCommentDto: CreatePostCommentDto) {
    return createPostCommentDto;
  }

  findAll() {
    return [];
  }

  findOne(id: string) {
    return { id };
  }

  update(id: string, updatePostCommentDto: UpdatePostCommentDto) {
    return {
      id,
      ...updatePostCommentDto,
    };
  }

  remove(id: string) {
    return { id };
  }
}
