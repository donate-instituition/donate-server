import { Types } from 'mongoose';

export interface MessageRead {
  userId?: string | Types.ObjectId;
  readAt?: Date;
}
