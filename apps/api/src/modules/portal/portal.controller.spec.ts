import type { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JwtAccessGuard, PlatformAdminGuard } from '../auth/auth.guards.js';
import { MeController, PlatformController } from './portal.controller.js';
import { PortalService } from './portal.service.js';

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    context.switchToHttp().getRequest().user = {
      sub: 'platform-admin-1',
      platformRole: 'PLATFORM_ADMIN',
      email: 'admin@example.com',
    };
    return true;
  }
}

describe('portal controllers', () => {
  let app: INestApplication;
  const service = {
    listStores: vi.fn().mockResolvedValue([]),
    createStore: vi.fn(),
    createInvitation: vi.fn().mockResolvedValue({
      id: 'invitation-1',
      token: 'plain-token-returned-once',
      expiresAt: '2026-11-01T00:00:00.000Z',
    }),
    deactivateStore: vi.fn().mockResolvedValue({ id: 'store-1', active: false }),
    listAudit: vi.fn().mockResolvedValue([]),
    getMyAccounts: vi.fn().mockResolvedValue([{ id: 'account-1' }]),
    getMyProfile: vi.fn().mockResolvedValue({
      id: 'platform-admin-1',
      platformRole: 'PLATFORM_ADMIN',
      storeAccesses: [],
    }),
    getMyStatements: vi.fn().mockResolvedValue([]),
    getMyPurchases: vi.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [PlatformController, MeController],
      providers: [{ provide: PortalService, useValue: service }],
    })
      .overrideGuard(JwtAccessGuard)
      .useValue(new TestAuthGuard())
      .overrideGuard(PlatformAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('creates an invitation and returns its raw token only in the command response', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/platform/invitations')
      .send({
        email: 'nuevo@example.com',
        platformRole: 'USER',
        storeId: 'store-1',
        storeRole: 'STORE_ADMIN',
        expiresAt: '2026-11-01T00:00:00.000Z',
      })
      .expect(201);
    expect(response.body.token).toBe('plain-token-returned-once');
    expect(service.createInvitation).toHaveBeenCalledWith(
      expect.anything(),
      'platform-admin-1',
    );
  });

  it('derives client portal ownership from the authenticated user', async () => {
    await request(app.getHttpServer()).get('/api/v1/me/accounts').expect(200);
    expect(service.getMyAccounts).toHaveBeenCalledWith('platform-admin-1');
  });

  it('returns the authenticated profile used for role routing', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/me/profile')
      .expect(200);
    expect(response.body.platformRole).toBe('PLATFORM_ADMIN');
    expect(service.getMyProfile).toHaveBeenCalledWith('platform-admin-1');
  });

  it('exposes logical store deletion for platform administrators', async () => {
    await request(app.getHttpServer())
      .delete('/api/v1/platform/stores/store-1')
      .expect(200);
    expect(service.deactivateStore).toHaveBeenCalledWith('store-1', 'platform-admin-1');
  });
});
