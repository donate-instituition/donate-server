import { Injectable } from '@nestjs/common';

import { CreateFollowDto } from './dto/create-follow.dto';
import { UpdateFollowDto } from './dto/update-follow.dto';

@Injectable()
export class FollowsService {
  create(createFollowDto: CreateFollowDto) {
    return createFollowDto;
  }

  findAll() {
    return [];
  }

  findOne(id: string) {
    return { id };
  }

  update(id: string, updateFollowDto: UpdateFollowDto) {
    return {
      id,
      ...updateFollowDto,
    };
  }

  remove(id: string) {
    return { id };
  }
}
