import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UnauthorizedException,
} from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { UserRole } from './models';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { UnregisterPushTokenDto } from './dto/unregister-push-token.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(UserRole.PLATFORM_ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  @Post('me/push-tokens')
  registerMyPushToken(
    @Body() registerPushTokenDto: RegisterPushTokenDto,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    if (!currentUser?.sub) {
      throw new UnauthorizedException('Authentication token is required');
    }

    return this.usersService.registerPushToken(
      currentUser.sub,
      registerPushTokenDto,
    );
  }

  @Post('me/push-tokens/remove')
  unregisterMyPushToken(
    @Body() unregisterPushTokenDto: UnregisterPushTokenDto,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    if (!currentUser?.sub) {
      throw new UnauthorizedException('Authentication token is required');
    }

    return this.usersService.unregisterPushToken(
      currentUser.sub,
      unregisterPushTokenDto,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
