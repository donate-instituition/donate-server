import { CategoryType } from '../models';

export class CreateCategoryDto {
  type!: CategoryType;

  name!: string;

  slug!: string;

  isActive?: boolean;
}
