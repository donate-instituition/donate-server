import { MessageAttachmentType } from '../enums';

export interface MessageAttachment {
  type?: MessageAttachmentType;
  url?: string;
  fileName?: string;
}
