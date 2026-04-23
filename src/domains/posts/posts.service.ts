import { Injectable } from '@nestjs/common';

import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostsService {
  create(createPostDto: CreatePostDto) {
    return createPostDto;
  }

  findAll() {
    return [];
  }

  findOne(id: string) {
    return { id };
  }

  update(id: string, updatePostDto: UpdatePostDto) {
    return {
      id,
      ...updatePostDto,
    };
  }

  remove(id: string) {
    return { id };
  }
}
