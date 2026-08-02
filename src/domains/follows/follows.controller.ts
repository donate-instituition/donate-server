import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CreateFollowDto } from './dto/create-follow.dto';
import { UpdateFollowDto } from './dto/update-follow.dto';
import { FollowsService } from './follows.service';

@Controller('follows')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Post()
  create(
    @Body() createFollowDto: CreateFollowDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.followsService.create(createFollowDto, user?.sub);
  }

  @Get('me')
  findMine(@CurrentUser() user: AuthenticatedUser | undefined) {
    return this.followsService.findMine(user?.sub);
  }

  @Get()
  findAll() {
    return this.followsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.followsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateFollowDto: UpdateFollowDto) {
    return this.followsService.update(id, updateFollowDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.followsService.remove(id);
  }

  @Delete(':targetType/:targetId')
  removeByTarget(
    @Param('targetType') targetType: string,
    @Param('targetId') targetId: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.followsService.removeByTarget(targetType, targetId, user?.sub);
  }
}
