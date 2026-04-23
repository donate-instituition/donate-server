import { Injectable } from '@nestjs/common';

import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  create(createCategoryDto: CreateCategoryDto) {
    return createCategoryDto;
  }

  findAll() {
    return [];
  }

  findOne(id: string) {
    return { id };
  }

  update(id: string, updateCategoryDto: UpdateCategoryDto) {
    return {
      id,
      ...updateCategoryDto,
    };
  }

  remove(id: string) {
    return { id };
  }
}
