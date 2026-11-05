import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../../database/prisma.service.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

describe('health endpoints', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  async function createApp(query: () => Promise<unknown>) {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: PrismaService, useValue: { $queryRaw: query } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  }

  it('reports liveness without depending on the database', async () => {
    const query = vi.fn();
    await createApp(query);
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200);
    expect(response.body.status).toBe('ok');
    expect(query).not.toHaveBeenCalled();
  });

  it('reports readiness only when the database responds', async () => {
    await createApp(vi.fn().mockResolvedValue([{ ready: 1 }]));
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200);
    expect(response.body).toMatchObject({ status: 'ready' });
  });

  it('returns 503 when the database is unavailable', async () => {
    await createApp(vi.fn().mockRejectedValue(new Error('database offline')));
    await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(503);
  });
});
