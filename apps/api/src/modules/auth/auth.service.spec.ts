import { JwtService } from '@nestjs/jwt';
import { hash } from '@node-rs/argon2';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  AuthService,
  type AuthServiceOptions,
  type Clock,
} from './auth.service.js';
import {
  type ActivateInvitationCommand,
  type AuthRepository,
  type AuthUser,
  type PendingInvitation,
  type RefreshSessionRecord,
  type SecurityEvent,
  type StoreAccessRecord,
} from './ports/auth.repository.js';

const NOW = new Date('2026-10-31T15:00:00.000Z');
const STORE_ID = 'store-a';

class FixedClock implements Clock {
  now(): Date {
    return new Date(NOW);
  }
}

class MemoryAuthRepository implements AuthRepository {
  readonly invitations = new Map<string, PendingInvitation>();
  readonly users = new Map<string, AuthUser>();
  readonly sessions = new Map<string, RefreshSessionRecord>();
  readonly accesses: StoreAccessRecord[] = [];
  readonly events: SecurityEvent[] = [];

  async findInvitationByTokenHash(tokenHash: string) {
    return this.invitations.get(tokenHash) ?? null;
  }

  async activateInvitation(command: ActivateInvitationCommand) {
    const invitation = this.invitations.get(command.invitationTokenHash);
    if (!invitation || invitation.status !== 'PENDING') {
      throw new Error('Invitation is no longer pending');
    }

    const user: AuthUser = {
      id: `user-${this.users.size + 1}`,
      username: command.username,
      email: invitation.email,
      displayName: command.displayName,
      passwordHash: command.passwordHash,
      platformRole: invitation.platformRole,
      active: true,
    };
    this.users.set(user.id, user);
    this.invitations.set(command.invitationTokenHash, {
      ...invitation,
      status: 'ACCEPTED',
    });
    if (invitation.storeId && invitation.storeRole) {
      this.accesses.push({
        userId: user.id,
        storeId: invitation.storeId,
        role: invitation.storeRole,
        active: true,
      });
    }
    return user;
  }

  async findUserByIdentifier(identifier: string) {
    return (
      [...this.users.values()].find(
        (user) => user.username === identifier || user.email === identifier,
      ) ?? null
    );
  }

  async findUserById(id: string) {
    return this.users.get(id) ?? null;
  }

  async touchLastAccess() {}

  async createRefreshSession(session: RefreshSessionRecord) {
    this.sessions.set(session.id, session);
  }

  async findRefreshSessionByTokenHash(tokenHash: string) {
    return (
      [...this.sessions.values()].find(
        (session) => session.tokenHash === tokenHash,
      ) ?? null
    );
  }

  async rotateRefreshSession(
    previousSessionId: string,
    replacement: RefreshSessionRecord,
    revokedAt: Date,
  ) {
    const previous = this.sessions.get(previousSessionId);
    if (!previous || previous.revokedAt) {
      throw new Error('Session is no longer active');
    }
    this.sessions.set(previousSessionId, {
      ...previous,
      revokedAt,
      replacedById: replacement.id,
    });
    this.sessions.set(replacement.id, replacement);
  }

  async revokeRefreshSession(sessionId: string, revokedAt: Date) {
    const session = this.sessions.get(sessionId);
    if (session && !session.revokedAt) {
      this.sessions.set(sessionId, { ...session, revokedAt });
    }
  }

  async findStoreAccess(userId: string, storeId: string) {
    return (
      this.accesses.find(
        (access) =>
          access.userId === userId &&
          access.storeId === storeId &&
          access.active,
      ) ?? null
    );
  }

  async recordSecurityEvent(event: SecurityEvent) {
    this.events.push(event);
  }
}

describe('AuthService', () => {
  let repository: MemoryAuthRepository;
  let service: AuthService;
  let invitationToken: string;

  const options: AuthServiceOptions = {
    accessTokenSecret: 'test-access-secret-with-at-least-32-characters',
    accessTokenTtlSeconds: 900,
    refreshTokenTtlSeconds: 2_592_000,
  };

  beforeEach(() => {
    repository = new MemoryAuthRepository();
    service = new AuthService(
      repository,
      new JwtService(),
      options,
      new FixedClock(),
    );
    invitationToken = 'invitation-token-with-enough-entropy';
    repository.invitations.set(service.digestToken(invitationToken), {
      id: 'invitation-1',
      email: 'cliente@example.com',
      tokenHash: service.digestToken(invitationToken),
      platformRole: 'USER',
      storeId: STORE_ID,
      storeRole: 'CLIENT',
      status: 'PENDING',
      expiresAt: new Date('2026-11-01T15:00:00.000Z'),
    });
  });

  it('activates a pending invitation once and creates tenant access', async () => {
    const result = await service.activate({
      token: invitationToken,
      username: 'cliente.demo',
      displayName: 'Cliente Demo',
      password: 'ClaveSegura#2026',
    });

    expect(result.accessToken).toBeTypeOf('string');
    expect(result.refreshToken).toBeTypeOf('string');
    expect(repository.accesses).toContainEqual({
      userId: 'user-1',
      storeId: STORE_ID,
      role: 'CLIENT',
      active: true,
    });
    expect(repository.events.at(-1)?.event).toBe('AUTH_INVITATION_ACTIVATED');
    await expect(
      service.activate({
        token: invitationToken,
        username: 'otro',
        displayName: 'Otro',
        password: 'ClaveSegura#2026',
      }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('rejects an expired invitation', async () => {
    const tokenHash = service.digestToken(invitationToken);
    repository.invitations.set(tokenHash, {
      ...repository.invitations.get(tokenHash)!,
      expiresAt: new Date('2026-10-30T15:00:00.000Z'),
    });

    await expect(
      service.activate({
        token: invitationToken,
        username: 'cliente.demo',
        displayName: 'Cliente Demo',
        password: 'ClaveSegura#2026',
      }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('logs in with Argon2id credentials and issues an access JWT', async () => {
    repository.users.set('user-existing', {
      id: 'user-existing',
      username: 'admin.demo',
      email: 'admin@example.com',
      displayName: 'Admin Demo',
      passwordHash: await hash('ClaveSegura#2026'),
      platformRole: 'PLATFORM_ADMIN',
      active: true,
    });

    const result = await service.login({
      identifier: 'admin@example.com',
      password: 'ClaveSegura#2026',
    });
    const claims = await new JwtService().verifyAsync(result.accessToken, {
      secret: options.accessTokenSecret,
    });

    expect(claims).toMatchObject({
      sub: 'user-existing',
      platformRole: 'PLATFORM_ADMIN',
    });
    expect(repository.events.at(-1)?.event).toBe('AUTH_LOGIN_SUCCEEDED');
  });

  it('rotates refresh tokens and rejects replay of the previous token', async () => {
    const activated = await service.activate({
      token: invitationToken,
      username: 'cliente.demo',
      displayName: 'Cliente Demo',
      password: 'ClaveSegura#2026',
    });

    const refreshed = await service.refresh(activated.refreshToken);
    expect(refreshed.refreshToken).not.toBe(activated.refreshToken);
    await expect(service.refresh(activated.refreshToken)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('revokes logout sessions and denies cross-store access', async () => {
    const activated = await service.activate({
      token: invitationToken,
      username: 'cliente.demo',
      displayName: 'Cliente Demo',
      password: 'ClaveSegura#2026',
    });
    const claims = await new JwtService().verifyAsync(activated.accessToken, {
      secret: options.accessTokenSecret,
    });

    await expect(
      service.assertStoreAccess(claims.sub, 'store-b', ['CLIENT']),
    ).rejects.toMatchObject({ status: 403 });
    await service.logout(activated.refreshToken);
    await expect(service.refresh(activated.refreshToken)).rejects.toMatchObject({
      status: 401,
    });
  });
});
