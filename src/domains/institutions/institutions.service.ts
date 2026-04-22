import { Injectable } from '@nestjs/common';

import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';

@Injectable()
export class InstitutionsService {
  create(createInstitutionDto: CreateInstitutionDto) {
    return createInstitutionDto;
  }

  findAll() {
    return [];
  }

  findOne(id: string) {
    return { id };
  }

  update(id: string, updateInstitutionDto: UpdateInstitutionDto) {
    return {
      id,
      ...updateInstitutionDto,
    };
  }

  remove(id: string) {
    return { id };
  }
}
