import { createHash, randomBytes, randomUUID } from 'node:crypto';

import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Algorithm, hash, verify } from '@node-rs/argon2';

import {
  type AuthRepository,
  type AuthUser,
  type RefreshSessionRecord,
  type StoreRole,
} from './ports/auth.repository.js';

export interface AuthServiceOptions {
  accessTokenSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
}

export interface Clock {
  now(): Date;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface AccessTokenClaims {
  sub: string;
  platformRole: 'PLATFORM_ADMIN' | 'USER';
  email: string;
}

const systemClock: Clock = { now: () => new Date() };

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly options: AuthServiceOptions,
    private readonly clock: Clock = systemClock,
  ) {}

  digestToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  async activate(input: {
    token: string;
    username: string;
    displayName: string;
    password: string;
  }): Promise<TokenPair> {
    const now = this.clock.now();
    const tokenHash = this.digestToken(input.token);
    const invitation = await this.repository.findInvitationByTokenHash(tokenHash);

    if (
      !invitation ||
      invitation.status !== 'PENDING' ||
      invitation.expiresAt.getTime() <= now.getTime()
    ) {
      throw new UnauthorizedException('La invitación no es válida o ya venció.');
    }

    const passwordHash = await hash(input.password, {
      algorithm: Algorithm.Argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
    const user = await this.repository.activateInvitation({
      invitationTokenHash: tokenHash,
      username: input.username,
      displayName: input.displayName,
      passwordHash,
      acceptedAt: now,
    });

    await this.repository.recordSecurityEvent({
      userId: user.id,
      storeId: invitation.storeId,
      event: 'AUTH_INVITATION_ACTIVATED',
      createdAt: now,
    });
    return this.issueTokenPair(user, now);
  }

  async login(input: {
    identifier: string;
    password: string;
  }): Promise<TokenPair> {
    const now = this.clock.now();
    const user = await this.repository.findUserByIdentifier(input.identifier);
    const authenticated =
      user?.active === true && (await verify(user.passwordHash, input.password));

    if (!authenticated || !user) {
      await this.repository.recordSecurityEvent({
        userId: user?.id ?? null,
        storeId: null,
        event: 'AUTH_LOGIN_FAILED',
        createdAt: now,
      });
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    await this.repository.touchLastAccess(user.id, now);
    await this.repository.recordSecurityEvent({
      userId: user.id,
      storeId: null,
      event: 'AUTH_LOGIN_SUCCEEDED',
      createdAt: now,
    });
    return this.issueTokenPair(user, now);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const now = this.clock.now();
    const session = await this.repository.findRefreshSessionByTokenHash(
      this.digestToken(refreshToken),
    );
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= now.getTime()
    ) {
      throw new UnauthorizedException('La sesión de renovación no es válida.');
    }

    const user = await this.repository.findUserById(session.userId);
    if (!user?.active) {
      throw new UnauthorizedException('El usuario ya no está activo.');
    }

    return this.issueTokenPair(user, now, session.id);
  }

  async logout(refreshToken: string): Promise<void> {
    const now = this.clock.now();
    const session = await this.repository.findRefreshSessionByTokenHash(
      this.digestToken(refreshToken),
    );
    if (session && !session.revokedAt) {
      await this.repository.revokeRefreshSession(session.id, now);
      await this.repository.recordSecurityEvent({
        userId: session.userId,
        storeId: null,
        event: 'AUTH_LOGOUT',
        createdAt: now,
      });
    }
  }

  async assertStoreAccess(
    userId: string,
    storeId: string,
    allowedRoles: StoreRole[],
  ): Promise<void> {
    const user = await this.repository.findUserById(userId);
    if (!user?.active) {
      throw new ForbiddenException('El usuario ya no está activo.');
    }
    if (user.platformRole === 'PLATFORM_ADMIN') {
      return;
    }

    const access = await this.repository.findStoreAccess(userId, storeId);
    if (!access || !allowedRoles.includes(access.role)) {
      throw new ForbiddenException('No tiene acceso a esta tienda.');
    }
  }

  private async issueTokenPair(
    user: AuthUser,
    now: Date,
    previousSessionId?: string,
  ): Promise<TokenPair> {
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        platformRole: user.platformRole,
        email: user.email,
      } satisfies AccessTokenClaims,
      {
        secret: this.options.accessTokenSecret,
        expiresIn: this.options.accessTokenTtlSeconds,
      },
    );
    const refreshToken = randomBytes(48).toString('base64url');
    const session: RefreshSessionRecord = {
      id: randomUUID(),
      userId: user.id,
      tokenHash: this.digestToken(refreshToken),
      expiresAt: new Date(
        now.getTime() + this.options.refreshTokenTtlSeconds * 1_000,
      ),
      revokedAt: null,
      replacedById: null,
      createdAt: now,
    };

    if (previousSessionId) {
      await this.repository.rotateRefreshSession(previousSessionId, session, now);
    } else {
      await this.repository.createRefreshSession(session);
    }

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.options.accessTokenTtlSeconds,
    };
  }
}
