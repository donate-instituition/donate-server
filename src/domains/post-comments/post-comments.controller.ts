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
import { CreatePostCommentDto } from './dto/create-post-comment.dto';
import { UpdatePostCommentDto } from './dto/update-post-comment.dto';
import { PostCommentsService } from './post-comments.service';

@Controller('post-comments')
export class PostCommentsController {
  constructor(private readonly postCommentsService: PostCommentsService) {}

  @Post()
  create(
    @Body() createPostCommentDto: CreatePostCommentDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.postCommentsService.create(createPostCommentDto, user?.sub);
  }

  @Get('post/:postId')
  findByPost(@Param('postId') postId: string) {
    return this.postCommentsService.findByPost(postId);
  }

  @Get()
  findAll() {
    return this.postCommentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postCommentsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePostCommentDto: UpdatePostCommentDto,
  ) {
    return this.postCommentsService.update(id, updatePostCommentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.postCommentsService.remove(id);
  }
}
