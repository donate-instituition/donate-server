import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { verify } from 'jsonwebtoken';
import type { Server, Socket } from 'socket.io';

import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { env } from '../../config/env';

@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class ConversationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server?: Server;

  private readonly logger = new Logger(ConversationsGateway.name);
  private readonly connectedUsers = new Map<string, AuthenticatedUser>();

  handleConnection(client: Socket) {
    const token = this.getToken(client);

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const user = verify(token, env.jwtSecret) as AuthenticatedUser;
      this.connectedUsers.set(client.id, user);
      void client.join(this.getUserRoom(user.sub));
      this.logger.debug(`Socket connected for user ${user.sub}`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.connectedUsers.get(client.id)?.sub;
    this.connectedUsers.delete(client.id);

    if (userId) {
      this.logger.debug(`Socket disconnected for user ${userId}`);
    }
  }

  emitConversationUpdated(participantIds: string[], payload: unknown) {
    this.emitToUsers(participantIds, 'conversation:updated', payload);
  }

  emitMessageCreated(participantIds: string[], payload: unknown) {
    this.emitToUsers(participantIds, 'message:new', payload);
  }

  emitUnreadUpdated(userId: string, payload: unknown) {
    this.server?.to(this.getUserRoom(userId)).emit('unread:update', payload);
  }

  private emitToUsers(userIds: string[], event: string, payload: unknown) {
    const uniqueUserIds = Array.from(new Set(userIds));

    uniqueUserIds.forEach((userId) => {
      this.server?.to(this.getUserRoom(userId)).emit(event, payload);
    });
  }

  private getToken(client: Socket) {
    const auth = client.handshake.auth as Record<string, unknown> | undefined;
    const authToken = auth?.token;
    const queryToken = client.handshake.query?.token;
    const header = client.handshake.headers.authorization;

    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim();
    }

    if (typeof queryToken === 'string' && queryToken.trim()) {
      return queryToken.trim();
    }

    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length).trim();
    }

    return undefined;
  }

  private getUserRoom(userId: string) {
    return `user:${userId}`;
  }
}
