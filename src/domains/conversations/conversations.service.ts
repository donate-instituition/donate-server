import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { InstitutionStaffMembershipStatus } from '../institution-staff-memberships/models';
import {
  InstitutionStaffMembership,
  InstitutionStaffMembershipDocument,
} from '../institution-staff-memberships/schemas/institution-staff-membership.schema';
import {
  Institution,
  InstitutionDocument,
} from '../institutions/schemas/institution.schema';
import { MessageType } from '../messages/models';
import { Message, MessageDocument } from '../messages/schemas/message.schema';
import { NotificationType } from '../notifications/models';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole } from '../users/models';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ConversationType } from './models';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { EnsureConversationDto } from './dto/ensure-conversation.dto';
import { SendConversationMessageDto } from './dto/send-conversation-message.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { ConversationsGateway } from './conversations.gateway';
import {
  Conversation,
  ConversationDocument,
} from './schemas/conversation.schema';

const SUPPORT_SUBJECT_KEY = 'platform-support';
const SUPPORT_TITLE = 'Equipe EloDoar';

type ConversationRecord = ConversationDocument;
type MessageRecord = MessageDocument;

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Institution.name)
    private readonly institutionModel: Model<InstitutionDocument>,
    @InjectModel(InstitutionStaffMembership.name)
    private readonly staffMembershipModel: Model<InstitutionStaffMembershipDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly conversationsGateway: ConversationsGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  private requireCurrentUser(currentUser?: AuthenticatedUser) {
    if (!currentUser) {
      throw new ForbiddenException('Authenticated user is required');
    }

    return currentUser;
  }

  private toObjectId(value?: string | Types.ObjectId) {
    const id = value?.toString();

    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid id');
    }

    return new Types.ObjectId(id);
  }

  private hasParticipant(
    conversation: ConversationRecord,
    userId: Types.ObjectId,
  ) {
    return conversation.participantIds.some(
      (participantId: Types.ObjectId) =>
        participantId.toString() === userId.toString(),
    );
  }

  private async getAuthorizedConversation(
    id: string,
    currentUser?: AuthenticatedUser,
  ) {
    const user = this.requireCurrentUser(currentUser);
    const userId = this.toObjectId(user.sub);
    const conversation = await this.conversationModel.findById(id).exec();

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (!this.hasParticipant(conversation, userId)) {
      throw new ForbiddenException('You cannot access this conversation');
    }

    return { conversation, userId };
  }

  private uniqueObjectIds(values: Types.ObjectId[]) {
    const seen = new Set<string>();
    return values.filter((value) => {
      const key = value.toString();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private getParticipantIdStrings(conversation: ConversationRecord) {
    return conversation.participantIds.map((participantId) =>
      participantId.toString(),
    );
  }

  private async getInstitutionIdentity(institutionId?: Types.ObjectId) {
    if (!institutionId) return undefined;

    const institution = await this.institutionModel
      .findById(institutionId)
      .select('displayName legalName logoUrl')
      .lean()
      .exec();

    if (!institution) return undefined;

    return {
      name: institution.displayName ?? institution.legalName,
      photoUrl: institution.logoUrl,
    };
  }

  private async isInstitutionStaffParticipant(
    institutionId: Types.ObjectId | undefined,
    userId: Types.ObjectId,
  ) {
    if (!institutionId) {
      return false;
    }

    const membership = await this.staffMembershipModel
      .exists({
        institutionId,
        status: InstitutionStaffMembershipStatus.ACTIVE,
        userId,
      })
      .exec();

    return Boolean(membership);
  }

  private async getCounterpartIdentity(
    conversation: ConversationRecord,
    currentUserId: Types.ObjectId,
    institutionIdentity?: { name: string; photoUrl?: string },
  ) {
    const institutionName = institutionIdentity?.name ?? 'Instituição';

    if (conversation.subjectKey === SUPPORT_SUBJECT_KEY) {
      return { name: SUPPORT_TITLE, photoUrl: undefined };
    }

    const isCurrentUserStaff = await this.isInstitutionStaffParticipant(
      conversation.institutionId,
      currentUserId,
    );

    if (!isCurrentUserStaff) {
      return { name: institutionName, photoUrl: institutionIdentity?.photoUrl };
    }

    const staffMemberships = conversation.institutionId
      ? await this.staffMembershipModel
          .find({
            institutionId: conversation.institutionId,
            status: InstitutionStaffMembershipStatus.ACTIVE,
          })
          .select('userId')
          .lean()
          .exec()
      : [];
    const staffUserIds = new Set(
      staffMemberships.map((membership) => membership.userId.toString()),
    );
    const counterpartUserId = conversation.participantIds.find(
      (participantId) => {
        const id = participantId.toString();
        return id !== currentUserId.toString() && !staffUserIds.has(id);
      },
    );

    if (!counterpartUserId) {
      return { name: institutionName, photoUrl: institutionIdentity?.photoUrl };
    }

    const counterpart = await this.userModel
      .findById(counterpartUserId)
      .select('fullName email profilePhotoUrl')
      .lean()
      .exec();

    return {
      name: counterpart?.fullName ?? counterpart?.email ?? institutionName,
      photoUrl: counterpart?.profilePhotoUrl,
    };
  }

  private async toConversationResponse(
    conversation: ConversationRecord,
    currentUserId: Types.ObjectId,
  ) {
    const lastMessage = await this.messageModel
      .findOne({ conversationId: conversation._id })
      .sort({ createdAt: -1 })
      .exec();
    const unreadCount = await this.messageModel
      .countDocuments({
        conversationId: conversation._id,
        senderUserId: { $ne: currentUserId },
        'readBy.userId': { $ne: currentUserId },
      })
      .exec();
    const institutionIdentity = await this.getInstitutionIdentity(
      conversation.institutionId,
    );
    const institutionName =
      conversation.title ?? institutionIdentity?.name ?? 'Instituição';
    const counterpart = await this.getCounterpartIdentity(
      conversation,
      currentUserId,
      { name: institutionName, photoUrl: institutionIdentity?.photoUrl },
    );

    return {
      id: conversation._id?.toString() ?? conversation.id,
      institutionId:
        conversation.subjectKey === SUPPORT_SUBJECT_KEY
          ? SUPPORT_SUBJECT_KEY
          : conversation.institutionId?.toString(),
      campaignId: conversation.campaignId?.toString(),
      counterpartName: counterpart.name,
      displayName: counterpart.name,
      institutionName,
      photoUrl: counterpart.photoUrl,
      lastMessage: lastMessage?.content ?? '',
      lastMessageAt:
        lastMessage?.createdAt?.toISOString?.() ??
        conversation.lastMessageAt?.toISOString?.() ??
        conversation.updatedAt?.toISOString?.() ??
        conversation.createdAt?.toISOString?.() ??
        new Date().toISOString(),
      unreadCount,
      subjectKey: conversation.subjectKey,
    };
  }

  private toMessageResponse(message: MessageRecord) {
    return {
      id: message._id?.toString() ?? message.id,
      conversationId: message.conversationId?.toString(),
      senderId: message.senderUserId?.toString(),
      content: message.content ?? '',
      messageType: message.messageType,
      attachments: message.attachments ?? [],
      createdAt:
        message.createdAt?.toISOString?.() ??
        message.createdAt ??
        new Date().toISOString(),
    };
  }

  async create(createConversationDto: CreateConversationDto) {
    const conversation = await this.conversationModel.create(
      createConversationDto,
    );

    return conversation;
  }

  async ensure(
    ensureConversationDto: EnsureConversationDto,
    currentUser?: AuthenticatedUser,
  ) {
    const user = this.requireCurrentUser(currentUser);
    const userId = this.toObjectId(user.sub);

    if (ensureConversationDto.support) {
      return this.ensureSupportConversation(userId);
    }

    const institutionId = this.toObjectId(ensureConversationDto.institutionId);
    const institution = await this.institutionModel
      .findById(institutionId)
      .select('_id displayName legalName')
      .lean()
      .exec();

    if (!institution) {
      throw new NotFoundException('Institution not found');
    }

    const staffMemberships = await this.staffMembershipModel
      .find({
        institutionId,
        status: InstitutionStaffMembershipStatus.ACTIVE,
      })
      .select('userId')
      .lean()
      .exec();
    const participantIds = this.uniqueObjectIds([
      userId,
      ...staffMemberships.map((membership) => membership.userId),
    ]);
    const campaignId = ensureConversationDto.campaignId
      ? this.toObjectId(ensureConversationDto.campaignId)
      : undefined;

    let conversation = await this.conversationModel
      .findOne({
        institutionId,
        participantIds: userId,
        subjectKey: { $exists: false },
      })
      .exec();

    if (!conversation) {
      conversation = await this.conversationModel.create({
        type: ConversationType.DIRECT,
        participantIds,
        institutionId,
        campaignId,
        title: institution.displayName ?? institution.legalName,
        lastMessageAt: new Date(),
      });
    } else {
      conversation.participantIds = this.uniqueObjectIds([
        ...conversation.participantIds,
        ...participantIds,
      ]);
      if (campaignId) {
        conversation.campaignId = campaignId;
      }
      conversation.title = institution.displayName ?? institution.legalName;
      await conversation.save();
    }

    const response = await this.toConversationResponse(conversation, userId);
    this.conversationsGateway.emitConversationUpdated(
      this.getParticipantIdStrings(conversation),
      response,
    );

    return response;
  }

  private async ensureSupportConversation(userId: Types.ObjectId) {
    const admins = await this.userModel
      .find({ 'roles.name': UserRole.PLATFORM_ADMIN })
      .select('_id')
      .lean()
      .exec();
    const participantIds = this.uniqueObjectIds([
      userId,
      ...admins.map((admin) => admin._id),
    ]);

    let conversation = await this.conversationModel
      .findOne({
        subjectKey: SUPPORT_SUBJECT_KEY,
        participantIds: userId,
      })
      .exec();

    if (!conversation) {
      conversation = await this.conversationModel.create({
        type: ConversationType.GROUP,
        participantIds,
        subjectKey: SUPPORT_SUBJECT_KEY,
        title: SUPPORT_TITLE,
        lastMessageAt: new Date(),
      });
    } else {
      conversation.participantIds = this.uniqueObjectIds([
        ...conversation.participantIds,
        ...participantIds,
      ]);
      conversation.title = SUPPORT_TITLE;
      await conversation.save();
    }

    const response = await this.toConversationResponse(conversation, userId);
    this.conversationsGateway.emitConversationUpdated(
      this.getParticipantIdStrings(conversation),
      response,
    );

    return response;
  }

  async findMine(currentUser?: AuthenticatedUser) {
    const user = this.requireCurrentUser(currentUser);
    const userId = this.toObjectId(user.sub);
    const conversations = await this.conversationModel
      .find({ participantIds: userId })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .exec();

    return Promise.all(
      conversations.map((conversation) =>
        this.toConversationResponse(conversation, userId),
      ),
    );
  }

  async findAll() {
    return this.conversationModel.find().sort({ updatedAt: -1 }).lean().exec();
  }

  async findOne(id: string, currentUser?: AuthenticatedUser) {
    const { conversation, userId } = await this.getAuthorizedConversation(
      id,
      currentUser,
    );

    return this.toConversationResponse(conversation, userId);
  }

  async findMessages(id: string, currentUser?: AuthenticatedUser) {
    const { conversation } = await this.getAuthorizedConversation(
      id,
      currentUser,
    );
    const messages = await this.messageModel
      .find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    return messages.map((message) => this.toMessageResponse(message));
  }

  async sendMessage(
    id: string,
    sendMessageDto: SendConversationMessageDto,
    currentUser?: AuthenticatedUser,
  ) {
    const { conversation, userId } = await this.getAuthorizedConversation(
      id,
      currentUser,
    );
    const content = sendMessageDto.content?.trim();

    if (!content) {
      throw new BadRequestException('Message content is required');
    }

    const now = new Date();
    const message = await this.messageModel.create({
      conversationId: conversation._id,
      senderUserId: userId,
      content,
      messageType: MessageType.TEXT,
      attachments: [],
      readBy: [{ userId, readAt: now }],
    });

    conversation.lastMessageAt = now;
    await conversation.save();

    const response = this.toMessageResponse(message);
    const participantIds = this.getParticipantIdStrings(conversation);
    const conversationResponse = await this.toConversationResponse(
      conversation,
      userId,
    );
    const recipients = participantIds.filter(
      (participantId) => participantId !== userId.toString(),
    );

    await Promise.all(
      recipients.map((recipientId) =>
        this.notificationsService.create({
          body: content,
          data: {
            conversationId: conversation._id.toString(),
            institutionId: conversation.institutionId?.toString(),
            messageId: message._id.toString(),
          },
          title: `Nova mensagem de ${conversationResponse.institutionName}`,
          type: NotificationType.NEW_MESSAGE,
          userId: new Types.ObjectId(recipientId),
        }),
      ),
    );

    this.conversationsGateway.emitMessageCreated(participantIds, response);
    this.conversationsGateway.emitConversationUpdated(
      participantIds,
      conversationResponse,
    );

    return response;
  }

  async markAsRead(id: string, currentUser?: AuthenticatedUser) {
    const { conversation, userId } = await this.getAuthorizedConversation(
      id,
      currentUser,
    );
    const readAt = new Date();
    const result = await this.messageModel
      .updateMany(
        {
          conversationId: conversation._id,
          senderUserId: { $ne: userId },
          'readBy.userId': { $ne: userId },
        },
        {
          $push: {
            readBy: { userId, readAt },
          },
        },
      )
      .exec();

    const payload = {
      conversationId: conversation._id.toString(),
      unreadCount: 0,
      updatedCount: result.modifiedCount ?? 0,
    };

    this.conversationsGateway.emitUnreadUpdated(userId.toString(), payload);

    return payload;
  }

  async update(id: string, updateConversationDto: UpdateConversationDto) {
    const conversation = await this.conversationModel
      .findByIdAndUpdate(id, updateConversationDto, { returnDocument: 'after' })
      .lean()
      .exec();

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  async remove(id: string) {
    const conversation = await this.conversationModel
      .findByIdAndDelete(id)
      .lean()
      .exec();

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return { id };
  }
}
