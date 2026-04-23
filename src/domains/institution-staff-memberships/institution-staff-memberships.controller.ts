import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

import { CreateInstitutionStaffMembershipDto } from './dto/create-institution-staff-membership.dto';
import { UpdateInstitutionStaffMembershipDto } from './dto/update-institution-staff-membership.dto';
import { InstitutionStaffMembershipsService } from './institution-staff-memberships.service';

@Controller('institution-staff-memberships')
export class InstitutionStaffMembershipsController {
  constructor(
    private readonly institutionStaffMembershipsService: InstitutionStaffMembershipsService,
  ) {}

  @Post()
  create(
    @Body()
    createInstitutionStaffMembershipDto: CreateInstitutionStaffMembershipDto,
  ) {
    return this.institutionStaffMembershipsService.create(
      createInstitutionStaffMembershipDto,
    );
  }

  @Get()
  findAll() {
    return this.institutionStaffMembershipsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.institutionStaffMembershipsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    updateInstitutionStaffMembershipDto: UpdateInstitutionStaffMembershipDto,
  ) {
    return this.institutionStaffMembershipsService.update(
      id,
      updateInstitutionStaffMembershipDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.institutionStaffMembershipsService.remove(id);
  }
}
