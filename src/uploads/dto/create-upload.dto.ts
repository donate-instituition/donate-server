import { UploadCategory } from '../models';

export class CreateUploadDto {
  base64!: string;

  category!: UploadCategory;

  contentType!: string;

  filename!: string;
}
