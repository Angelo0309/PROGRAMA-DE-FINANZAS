export type PlatformRole = 'PLATFORM_ADMIN' | 'USER';
export type StoreRole = 'STORE_ADMIN' | 'OPERATOR' | 'CLIENT';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

export interface PendingInvitation {
  id: string;
  email: string;
  tokenHash: string;
  platformRole: PlatformRole;
  storeId: string | null;
  storeRole: StoreRole | null;
  status: InvitationStatus;
  expiresAt: Date;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  passwordHash: string;
  platformRole: PlatformRole;
  active: boolean;
}

export interface StoreAccessRecord {
  userId: string;
  storeId: string;
  role: StoreRole;
  active: boolean;
}

export interface RefreshSessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
  createdAt: Date;
}

export interface SecurityEvent {
  userId: string | null;
  storeId: string | null;
  event: string;
  details?: Record<string, string>;
  createdAt: Date;
}

export interface ActivateInvitationCommand {
  invitationTokenHash: string;
  username: string;
  displayName: string;
  passwordHash: string;
  acceptedAt: Date;
}

export interface AuthRepository {
  findInvitationByTokenHash(tokenHash: string): Promise<PendingInvitation | null>;
  activateInvitation(command: ActivateInvitationCommand): Promise<AuthUser>;
  findUserByIdentifier(identifier: string): Promise<AuthUser | null>;
  findUserById(id: string): Promise<AuthUser | null>;
  touchLastAccess(userId: string, at: Date): Promise<void>;
  createRefreshSession(session: RefreshSessionRecord): Promise<void>;
  findRefreshSessionByTokenHash(
    tokenHash: string,
  ): Promise<RefreshSessionRecord | null>;
  rotateRefreshSession(
    previousSessionId: string,
    replacement: RefreshSessionRecord,
    revokedAt: Date,
  ): Promise<void>;
  revokeRefreshSession(sessionId: string, revokedAt: Date): Promise<void>;
  findStoreAccess(
    userId: string,
    storeId: string,
  ): Promise<StoreAccessRecord | null>;
  recordSecurityEvent(event: SecurityEvent): Promise<void>;
}
