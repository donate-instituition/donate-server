import { Types } from 'mongoose';

import { ConversationType } from '../models';

export class UpdateConversationDto {
  type?: ConversationType;

  participantIds?: Types.ObjectId[];

  institutionId?: Types.ObjectId;

  campaignId?: Types.ObjectId;

  lastMessageAt?: Date;
}
