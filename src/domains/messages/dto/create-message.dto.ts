import { Types } from 'mongoose';

import { MessageType } from '../models';
import type { MessageAttachment, MessageRead } from '../models';

export class CreateMessageDto {
  conversationId!: Types.ObjectId;

  senderUserId!: Types.ObjectId;

  content?: string;

  messageType!: MessageType;

  attachments?: MessageAttachment[];

  readBy?: MessageRead[];
}
