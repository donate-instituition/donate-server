import { Types } from 'mongoose';

import { ConversationType } from '../models';

export class CreateConversationDto {
  type!: ConversationType;

  participantIds!: Types.ObjectId[];

  institutionId?: Types.ObjectId;

  campaignId?: Types.ObjectId;

  lastMessageAt?: Date;
}
