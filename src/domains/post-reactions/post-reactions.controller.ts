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
import { CreatePostReactionDto } from './dto/create-post-reaction.dto';
import { UpdatePostReactionDto } from './dto/update-post-reaction.dto';
import { PostReactionsService } from './post-reactions.service';

@Controller('post-reactions')
export class PostReactionsController {
  constructor(private readonly postReactionsService: PostReactionsService) {}

  @Post()
  create(
    @Body() createPostReactionDto: CreatePostReactionDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.postReactionsService.create(createPostReactionDto, user?.sub);
  }

  @Delete('post/:postId')
  removeMineByPost(
    @Param('postId') postId: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.postReactionsService.removeMineByPost(postId, user?.sub);
  }

  @Get('me')
  getMyLikedPostIds(@CurrentUser() user: AuthenticatedUser | undefined) {
    return this.postReactionsService.getMyLikedPostIds(user?.sub);
  }

  @Get()
  findAll() {
    return this.postReactionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postReactionsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePostReactionDto: UpdatePostReactionDto,
  ) {
    return this.postReactionsService.update(id, updatePostReactionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.postReactionsService.remove(id);
  }
}
