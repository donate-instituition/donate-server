import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { NotificationType } from '../notifications/models';
import { UserRole, UserStatus, UserType } from '../users/models';
import { ConversationType } from './models';
import { MessageType } from '../messages/models';
import { ConversationsService } from './conversations.service';

const USER_ID = '507f1f77bcf86cd799439011';
const OTHER_USER_ID = '507f1f77bcf86cd799439012';
const INSTITUTION_ID = '507f1f77bcf86cd799439013';
const CONVERSATION_ID = '507f1f77bcf86cd799439014';
const ADMIN_ID = '507f1f77bcf86cd799439015';
const CAMPAIGN_ID = '507f1f77bcf86cd799439016';

const currentUser: AuthenticatedUser = {
  sub: USER_ID,
  email: 'user@test.com',
  roles: [UserRole.DONOR],
  type: UserType.PERSON,
  status: UserStatus.ACTIVE,
};

function execResolve(value: unknown) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

function selectLeanExec(value: unknown) {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue(execResolve(value)),
    }),
  };
}

function sortLeanExec(value: unknown) {
  return {
    sort: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue(execResolve(value)),
      exec: jest.fn().mockResolvedValue(value),
    }),
  };
}

function buildConversation(overrides: Record<string, unknown> = {}) {
  return {
    _id: CONVERSATION_ID,
    participantIds: [USER_ID],
    institutionId: INSTITUTION_ID,
    campaignId: undefined,
    subjectKey: undefined,
    title: 'Instituição Teste',
    lastMessageAt: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildMessage(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'msg-1',
    conversationId: CONVERSATION_ID,
    senderUserId: USER_ID,
    content: 'Hello',
    messageType: MessageType.TEXT,
    attachments: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildMessageModel(overrides: Record<string, unknown> = {}) {
  return {
    countDocuments: jest.fn().mockReturnValue(execResolve(0)),
    create: jest.fn().mockResolvedValue(buildMessage()),
    find: jest.fn().mockReturnValue(sortLeanExec([])),
    findOne: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue(execResolve(null)),
    }),
    updateMany: jest.fn().mockReturnValue(execResolve({ modifiedCount: 0 })),
    ...overrides,
  };
}

function buildInstitutionModel(overrides: Record<string, unknown> = {}) {
  return {
    findById: jest.fn().mockReturnValue(
      selectLeanExec({
        _id: INSTITUTION_ID,
        displayName: 'Instituição Teste',
        legalName: 'Instituição Teste Legal',
        logoUrl: 'https://logo.test/logo.png',
      }),
    ),
    ...overrides,
  };
}

function buildStaffModel(overrides: Record<string, unknown> = {}) {
  return {
    exists: jest.fn().mockReturnValue(execResolve(null)),
    find: jest.fn().mockReturnValue(selectLeanExec([])),
    ...overrides,
  };
}

function buildUserModel(overrides: Record<string, unknown> = {}) {
  return {
    find: jest.fn().mockReturnValue(selectLeanExec([])),
    findById: jest.fn().mockReturnValue(selectLeanExec(null)),
    ...overrides,
  };
}

function buildGateway() {
  return {
    emitConversationUpdated: jest.fn(),
    emitMessageCreated: jest.fn(),
    emitUnreadUpdated: jest.fn(),
  };
}

function buildNotificationsService() {
  return {
    create: jest.fn().mockResolvedValue(undefined),
  };
}

describe('ConversationsService', () => {
  function createService(models: {
    conversationModel?: any;
    messageModel?: any;
    institutionModel?: any;
    staffMembershipModel?: any;
    userModel?: any;
    gateway?: any;
    notificationsService?: any;
  } = {}) {
    const gateway = models.gateway ?? buildGateway();
    const notificationsService =
      models.notificationsService ?? buildNotificationsService();

    const service = new ConversationsService(
      (models.conversationModel ?? {}) as any,
      (models.messageModel ?? buildMessageModel()) as any,
      (models.institutionModel ?? buildInstitutionModel()) as any,
      (models.staffMembershipModel ?? buildStaffModel()) as any,
      (models.userModel ?? buildUserModel()) as any,
      gateway as any,
      notificationsService as any,
    );

    return { service, gateway, notificationsService };
  }

  describe('ensure', () => {
    it('throws ForbiddenException when there is no current user', async () => {
      const { service } = createService();

      await expect(service.ensure({ institutionId: INSTITUTION_ID })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException for an invalid institutionId', async () => {
      const { service } = createService();

      await expect(
        service.ensure({ institutionId: 'not-an-id' }, currentUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when the institution does not exist', async () => {
      const institutionModel = buildInstitutionModel({
        findById: jest.fn().mockReturnValue(selectLeanExec(null)),
      });
      const { service } = createService({ institutionModel });

      await expect(
        service.ensure({ institutionId: INSTITUTION_ID }, currentUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates a new direct conversation when none exists yet', async () => {
      const conversationModel = {
        findOne: jest.fn().mockReturnValue(execResolve(null)),
        create: jest.fn().mockResolvedValue(buildConversation()),
      };
      const { service, gateway } = createService({ conversationModel });

      const response = await service.ensure(
        { institutionId: INSTITUTION_ID, campaignId: CAMPAIGN_ID },
        currentUser,
      );

      expect(conversationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ConversationType.DIRECT,
          institutionId: expect.anything(),
        }),
      );
      expect(response).toEqual(
        expect.objectContaining({ id: CONVERSATION_ID }),
      );
      expect(gateway.emitConversationUpdated).toHaveBeenCalled();
    });

    it('merges participants into an existing direct conversation', async () => {
      const existing = buildConversation({ participantIds: [USER_ID] });
      const conversationModel = {
        findOne: jest.fn().mockReturnValue(execResolve(existing)),
        create: jest.fn(),
      };
      const { service, gateway } = createService({ conversationModel });

      const response = await service.ensure(
        { institutionId: INSTITUTION_ID },
        currentUser,
      );

      expect(conversationModel.create).not.toHaveBeenCalled();
      expect(existing.save).toHaveBeenCalled();
      expect(response).toEqual(
        expect.objectContaining({ id: CONVERSATION_ID }),
      );
      expect(gateway.emitConversationUpdated).toHaveBeenCalled();
    });

    it('creates a new support conversation with admins', async () => {
      const conversationModel = {
        findOne: jest.fn().mockReturnValue(execResolve(null)),
        create: jest.fn().mockResolvedValue(
          buildConversation({
            institutionId: undefined,
            subjectKey: 'platform-support',
            title: 'Equipe EloDoar',
          }),
        ),
      };
      const userModel = buildUserModel({
        find: jest
          .fn()
          .mockReturnValue(selectLeanExec([{ _id: ADMIN_ID }])),
      });
      const { service, gateway } = createService({
        conversationModel,
        userModel,
      });

      const response = await service.ensure({ support: true }, currentUser);

      expect(conversationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ConversationType.GROUP,
          subjectKey: 'platform-support',
        }),
      );
      expect(response.counterpartName).toBe('Equipe EloDoar');
      expect(gateway.emitConversationUpdated).toHaveBeenCalled();
    });

    it('reuses and updates an existing support conversation', async () => {
      const existing = buildConversation({
        institutionId: undefined,
        subjectKey: 'platform-support',
        title: 'Equipe EloDoar',
      });
      const conversationModel = {
        findOne: jest.fn().mockReturnValue(execResolve(existing)),
        create: jest.fn(),
      };
      const { service } = createService({ conversationModel });

      const response = await service.ensure({ support: true }, currentUser);

      expect(conversationModel.create).not.toHaveBeenCalled();
      expect(existing.save).toHaveBeenCalled();
      expect(response.counterpartName).toBe('Equipe EloDoar');
    });
  });

  describe('findMine', () => {
    it('throws ForbiddenException without a current user', async () => {
      const { service } = createService();

      await expect(service.findMine(undefined)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns mapped conversations for the current user', async () => {
      const conversation = buildConversation();
      const conversationModel = {
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue(execResolve([conversation])),
        }),
      };
      const { service } = createService({ conversationModel });

      const result = await service.findMine(currentUser);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({ id: CONVERSATION_ID }),
      );
    });
  });

  describe('findAll', () => {
    it('returns the lean conversation list', async () => {
      const conversationModel = {
        find: jest.fn().mockReturnValue(sortLeanExec([{ _id: CONVERSATION_ID }])),
      };
      const { service } = createService({ conversationModel });

      const result = await service.findAll();

      expect(result).toEqual([{ _id: CONVERSATION_ID }]);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the conversation does not exist', async () => {
      const conversationModel = {
        findById: jest.fn().mockReturnValue(execResolve(null)),
      };
      const { service } = createService({ conversationModel });

      await expect(service.findOne(CONVERSATION_ID, currentUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when the user is not a participant', async () => {
      const conversation = buildConversation({ participantIds: [OTHER_USER_ID] });
      const conversationModel = {
        findById: jest.fn().mockReturnValue(execResolve(conversation)),
      };
      const { service } = createService({ conversationModel });

      await expect(service.findOne(CONVERSATION_ID, currentUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns the conversation response for a support conversation', async () => {
      const conversation = buildConversation({
        subjectKey: 'platform-support',
        institutionId: undefined,
      });
      const conversationModel = {
        findById: jest.fn().mockReturnValue(execResolve(conversation)),
      };
      const { service } = createService({ conversationModel });

      const result = await service.findOne(CONVERSATION_ID, currentUser);

      expect(result.institutionId).toBe('platform-support');
      expect(result.counterpartName).toBe('Equipe EloDoar');
    });

    it('returns the institution name as counterpart when the user is not staff', async () => {
      const conversation = buildConversation({
        participantIds: [USER_ID, OTHER_USER_ID],
      });
      const conversationModel = {
        findById: jest.fn().mockReturnValue(execResolve(conversation)),
      };
      const staffMembershipModel = buildStaffModel({
        exists: jest.fn().mockReturnValue(execResolve(null)),
      });
      const { service } = createService({ conversationModel, staffMembershipModel });

      const result = await service.findOne(CONVERSATION_ID, currentUser);

      expect(result.counterpartName).toBe('Instituição Teste');
    });

    it('returns the counterpart user identity when the current user is staff', async () => {
      const conversation = buildConversation({
        participantIds: [USER_ID, OTHER_USER_ID],
      });
      const conversationModel = {
        findById: jest.fn().mockReturnValue(execResolve(conversation)),
      };
      const staffMembershipModel = buildStaffModel({
        exists: jest.fn().mockReturnValue(execResolve({ _id: 'membership-1' })),
        find: jest.fn().mockReturnValue(selectLeanExec([{ userId: USER_ID }])),
      });
      const userModel = buildUserModel({
        findById: jest.fn().mockReturnValue(
          selectLeanExec({
            fullName: 'Counterpart Person',
            email: 'counterpart@test.com',
            profilePhotoUrl: 'https://photo.test/p.png',
          }),
        ),
      });
      const { service } = createService({
        conversationModel,
        staffMembershipModel,
        userModel,
      });

      const result = await service.findOne(CONVERSATION_ID, currentUser);

      expect(result.counterpartName).toBe('Counterpart Person');
      expect(result.photoUrl).toBe('https://photo.test/p.png');
    });

    it('falls back to the institution name when no counterpart can be found', async () => {
      const conversation = buildConversation({ participantIds: [USER_ID] });
      const conversationModel = {
        findById: jest.fn().mockReturnValue(execResolve(conversation)),
      };
      const staffMembershipModel = buildStaffModel({
        exists: jest.fn().mockReturnValue(execResolve({ _id: 'membership-1' })),
        find: jest.fn().mockReturnValue(selectLeanExec([{ userId: USER_ID }])),
      });
      const { service } = createService({ conversationModel, staffMembershipModel });

      const result = await service.findOne(CONVERSATION_ID, currentUser);

      expect(result.counterpartName).toBe('Instituição Teste');
    });
  });

  describe('findMessages', () => {
    it('returns mapped messages for an authorized conversation', async () => {
      const conversation = buildConversation();
      const conversationModel = {
        findById: jest.fn().mockReturnValue(execResolve(conversation)),
      };
      const messageModel = buildMessageModel({
        find: jest.fn().mockReturnValue(sortLeanExec([buildMessage()])),
      });
      const { service } = createService({ conversationModel, messageModel });

      const result = await service.findMessages(CONVERSATION_ID, currentUser);

      expect(result).toEqual([
        expect.objectContaining({ id: 'msg-1', content: 'Hello' }),
      ]);
    });
  });

  describe('sendMessage', () => {
    it('throws BadRequestException for empty content', async () => {
      const conversation = buildConversation();
      const conversationModel = {
        findById: jest.fn().mockReturnValue(execResolve(conversation)),
      };
      const { service } = createService({ conversationModel });

      await expect(
        service.sendMessage(CONVERSATION_ID, { content: '   ' }, currentUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a message, notifies recipients, and emits gateway events', async () => {
      const conversation = buildConversation({
        participantIds: [USER_ID, OTHER_USER_ID],
      });
      const conversationModel = {
        findById: jest.fn().mockReturnValue(execResolve(conversation)),
      };
      const createdMessage = buildMessage({ content: 'Olá mundo' });
      const messageModel = buildMessageModel({
        create: jest.fn().mockResolvedValue(createdMessage),
      });
      const { service, gateway, notificationsService } = createService({
        conversationModel,
        messageModel,
      });

      const result = await service.sendMessage(
        CONVERSATION_ID,
        { content: 'Olá mundo' },
        currentUser,
      );

      expect(messageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Olá mundo',
          senderUserId: expect.anything(),
          messageType: MessageType.TEXT,
        }),
      );
      expect(conversation.save).toHaveBeenCalled();
      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.NEW_MESSAGE,
          body: 'Olá mundo',
        }),
      );
      expect(gateway.emitMessageCreated).toHaveBeenCalled();
      expect(gateway.emitConversationUpdated).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({ content: 'Olá mundo' }),
      );
    });

    it('does not notify the sender itself when alone in the conversation', async () => {
      const conversation = buildConversation({ participantIds: [USER_ID] });
      const conversationModel = {
        findById: jest.fn().mockReturnValue(execResolve(conversation)),
      };
      const { service, notificationsService } = createService({ conversationModel });

      await service.sendMessage(CONVERSATION_ID, { content: 'Hi' }, currentUser);

      expect(notificationsService.create).not.toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('marks messages as read and emits the unread update event', async () => {
      const conversation = buildConversation();
      const conversationModel = {
        findById: jest.fn().mockReturnValue(execResolve(conversation)),
      };
      const messageModel = buildMessageModel({
        updateMany: jest.fn().mockReturnValue(execResolve({ modifiedCount: 3 })),
      });
      const { service, gateway } = createService({ conversationModel, messageModel });

      const result = await service.markAsRead(CONVERSATION_ID, currentUser);

      expect(result).toEqual({
        conversationId: CONVERSATION_ID,
        unreadCount: 0,
        updatedCount: 3,
      });
      expect(gateway.emitUnreadUpdated).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ updatedCount: 3 }),
      );
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the conversation does not exist', async () => {
      const conversationModel = {
        findByIdAndUpdate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue(execResolve(null)),
        }),
      };
      const { service } = createService({ conversationModel });

      await expect(service.update(CONVERSATION_ID, {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the updated conversation', async () => {
      const updated = { _id: CONVERSATION_ID, title: 'Updated' };
      const conversationModel = {
        findByIdAndUpdate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue(execResolve(updated)),
        }),
      };
      const { service } = createService({ conversationModel });

      const result = await service.update(CONVERSATION_ID, { title: 'Updated' } as any);

      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the conversation does not exist', async () => {
      const conversationModel = {
        findByIdAndDelete: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue(execResolve(null)),
        }),
      };
      const { service } = createService({ conversationModel });

      await expect(service.remove(CONVERSATION_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('removes the conversation and returns its id', async () => {
      const conversationModel = {
        findByIdAndDelete: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue(execResolve({ _id: CONVERSATION_ID })),
        }),
      };
      const { service } = createService({ conversationModel });

      const result = await service.remove(CONVERSATION_ID);

      expect(result).toEqual({ id: CONVERSATION_ID });
    });
  });

  describe('create', () => {
    it('creates a conversation with the given dto', async () => {
      const created = { _id: CONVERSATION_ID };
      const conversationModel = {
        create: jest.fn().mockResolvedValue(created),
      };
      const { service } = createService({ conversationModel });

      const result = await service.create({
        type: ConversationType.DIRECT,
        participantIds: [],
      } as any);

      expect(result).toBe(created);
    });
  });
});
