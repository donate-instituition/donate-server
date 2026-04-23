import { Injectable } from '@nestjs/common';

import { CreateInstitutionStaffMembershipDto } from './dto/create-institution-staff-membership.dto';
import { UpdateInstitutionStaffMembershipDto } from './dto/update-institution-staff-membership.dto';

@Injectable()
export class InstitutionStaffMembershipsService {
  create(
    createInstitutionStaffMembershipDto: CreateInstitutionStaffMembershipDto,
  ) {
    return createInstitutionStaffMembershipDto;
  }

  findAll() {
    return [];
  }

  findOne(id: string) {
    return { id };
  }

  update(
    id: string,
    updateInstitutionStaffMembershipDto: UpdateInstitutionStaffMembershipDto,
  ) {
    return {
      id,
      ...updateInstitutionStaffMembershipDto,
    };
  }

  remove(id: string) {
    return { id };
  }
}
