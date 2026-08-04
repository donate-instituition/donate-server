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
import { CreateConversationDto } from './dto/create-conversation.dto';
import { EnsureConversationDto } from './dto/ensure-conversation.dto';
import { SendConversationMessageDto } from './dto/send-conversation-message.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  create(@Body() createConversationDto: CreateConversationDto) {
    return this.conversationsService.create(createConversationDto);
  }

  @Post('ensure')
  ensure(
    @Body() ensureConversationDto: EnsureConversationDto,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    return this.conversationsService.ensure(ensureConversationDto, currentUser);
  }

  @Get('me')
  findMine(@CurrentUser() currentUser?: AuthenticatedUser) {
    return this.conversationsService.findMine(currentUser);
  }

  @Get()
  findAll() {
    return this.conversationsService.findAll();
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    return this.conversationsService.findOne(id, currentUser);
  }

  @Get(':id/messages')
  findMessages(
    @Param('id') id: string,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    return this.conversationsService.findMessages(id, currentUser);
  }

  @Post(':id/messages')
  sendMessage(
    @Param('id') id: string,
    @Body() sendMessageDto: SendConversationMessageDto,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    return this.conversationsService.sendMessage(
      id,
      sendMessageDto,
      currentUser,
    );
  }

  @Post(':id/read')
  markAsRead(
    @Param('id') id: string,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    return this.conversationsService.markAsRead(id, currentUser);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateConversationDto: UpdateConversationDto,
  ) {
    return this.conversationsService.update(id, updateConversationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.conversationsService.remove(id);
  }
}
