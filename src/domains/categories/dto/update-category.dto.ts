import { CategoryType } from '../models';

export class UpdateCategoryDto {
  type?: CategoryType;

  name?: string;

  slug?: string;

  isActive?: boolean;
}
