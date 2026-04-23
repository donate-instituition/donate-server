import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { MessageAttachmentType, MessageType } from '../models';
import type { MessageAttachment, MessageRead } from '../models';

export type MessageDocument = HydratedDocument<Message>;

@Schema({
  collection: 'messages',
  timestamps: true,
  versionKey: false,
})
export class Message {
  _id!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Conversation' })
  conversationId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  senderUserId!: Types.ObjectId;

  @Prop({ trim: true })
  content?: string;

  @Prop({
    required: true,
    enum: MessageType,
    type: String,
  })
  messageType!: MessageType;

  @Prop({
    type: [
      raw({
        type: {
          type: String,
          enum: MessageAttachmentType,
        },
        url: {
          type: String,
          trim: true,
        },
        fileName: {
          type: String,
          trim: true,
        },
      }),
    ],
    default: [],
  })
  attachments!: MessageAttachment[];

  @Prop({
    type: [
      raw({
        userId: {
          type: Types.ObjectId,
          ref: 'User',
        },
        readAt: {
          type: Date,
        },
      }),
    ],
    default: [],
  })
  readBy!: MessageRead[];

  createdAt!: Date;

  updatedAt!: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
