import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import type {
  ActivateInvitationCommand,
  AuthRepository,
  AuthUser,
  PendingInvitation,
  RefreshSessionRecord,
  SecurityEvent,
  StoreAccessRecord,
} from './ports/auth.repository.js';

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findInvitationByTokenHash(
    tokenHash: string,
  ): Promise<PendingInvitation | null> {
    const invitation = await this.prisma.userInvitation.findUnique({
      where: { tokenHash },
    });
    return invitation ? { ...invitation } : null;
  }

  async activateInvitation(
    command: ActivateInvitationCommand,
  ): Promise<AuthUser> {
    return this.prisma.$transaction(async (transaction) => {
      const invitation = await transaction.userInvitation.findUnique({
        where: { tokenHash: command.invitationTokenHash },
      });
      if (!invitation || invitation.status !== 'PENDING') {
        throw new Error('Invitation is no longer pending');
      }

      const user = await transaction.user.create({
        data: {
          username: command.username,
          email: invitation.email,
          displayName: command.displayName,
          passwordHash: command.passwordHash,
          platformRole: invitation.platformRole,
          emailVerifiedAt: command.acceptedAt,
        },
      });
      await transaction.userInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: command.acceptedAt },
      });
      if (invitation.storeId && invitation.storeRole) {
        await transaction.storeAccess.create({
          data: {
            userId: user.id,
            storeId: invitation.storeId,
            role: invitation.storeRole,
          },
        });
      }
      return this.toAuthUser(user);
    });
  }

  async findUserByIdentifier(identifier: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier }] },
    });
    return user ? this.toAuthUser(user) : null;
  }

  async findUserById(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.toAuthUser(user) : null;
  }

  async touchLastAccess(userId: string, at: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastAccessAt: at },
    });
  }

  async createRefreshSession(session: RefreshSessionRecord): Promise<void> {
    await this.prisma.refreshSession.create({ data: session });
  }

  async findRefreshSessionByTokenHash(
    tokenHash: string,
  ): Promise<RefreshSessionRecord | null> {
    return this.prisma.refreshSession.findUnique({ where: { tokenHash } });
  }

  async rotateRefreshSession(
    previousSessionId: string,
    replacement: RefreshSessionRecord,
    revokedAt: Date,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.refreshSession.create({ data: replacement });
      const result = await transaction.refreshSession.updateMany({
        where: { id: previousSessionId, revokedAt: null },
        data: { revokedAt, replacedById: replacement.id },
      });
      if (result.count !== 1) {
        throw new Error('Session is no longer active');
      }
    });
  }

  async revokeRefreshSession(sessionId: string, revokedAt: Date): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt },
    });
  }

  async findStoreAccess(
    userId: string,
    storeId: string,
  ): Promise<StoreAccessRecord | null> {
    return this.prisma.storeAccess.findFirst({
      where: { userId, storeId, active: true },
      select: { userId: true, storeId: true, role: true, active: true },
    });
  }

  async recordSecurityEvent(event: SecurityEvent): Promise<void> {
    await this.prisma.auditEvent.create({ data: event });
  }

  private toAuthUser(user: {
    id: string;
    username: string;
    email: string;
    displayName: string;
    passwordHash: string;
    platformRole: 'PLATFORM_ADMIN' | 'USER';
    active: boolean;
  }): AuthUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      passwordHash: user.passwordHash,
      platformRole: user.platformRole,
      active: user.active,
    };
  }
}
