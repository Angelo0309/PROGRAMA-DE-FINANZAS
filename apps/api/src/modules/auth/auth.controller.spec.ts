import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let app: INestApplication;
  const tokens = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    tokenType: 'Bearer' as const,
    expiresIn: 900,
  };
  const authService = {
    activate: vi.fn().mockResolvedValue(tokens),
    login: vi.fn().mockResolvedValue(tokens),
    refresh: vi.fn().mockResolvedValue(tokens),
    logout: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const testingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();
    app = testingModule.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('exposes activation and returns decimal-safe token metadata', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/activate')
      .send({
        token: 'invitation-token-with-enough-entropy',
        username: 'cliente.demo',
        displayName: 'Cliente Demo',
        password: 'ClaveSegura#2026',
      })
      .expect(201);

    expect(response.body).toEqual(tokens);
    expect(authService.activate).toHaveBeenCalledOnce();
  });

  it('rejects malformed credentials before calling the service', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: '', password: '123' })
      .expect(400);

    expect(authService.login).not.toHaveBeenCalled();
  });

  it('rotates and revokes refresh tokens through the public contract', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'refresh-token-with-enough-entropy' })
      .expect(201, tokens);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: 'refresh-token-with-enough-entropy' })
      .expect(204);
  });
});
