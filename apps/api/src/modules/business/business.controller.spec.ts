import type { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JwtAccessGuard, STORE_ROLES, StoreAccessGuard } from '../auth/auth.guards.js';
import { BusinessService } from './business.service.js';
import { BusinessController } from './business.controller.js';

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    context.switchToHttp().getRequest().user = {
      sub: 'admin-1',
      platformRole: 'USER',
      email: 'admin@example.com',
    };
    return true;
  }
}

describe('BusinessController', () => {
  let app: INestApplication;
  const service = {
    createProduct: vi.fn().mockResolvedValue({
      id: 'product-1',
      unitPrice: '120.0000',
      currency: 'PEN',
    }),
    listProducts: vi.fn().mockResolvedValue([]),
    createClient: vi.fn().mockResolvedValue({ id: 'client-1' }),
    listClients: vi.fn().mockResolvedValue([]),
    createAccount: vi.fn(),
    listAccounts: vi.fn().mockResolvedValue([]),
    addCreditCondition: vi.fn(),
    getSchedule: vi.fn().mockResolvedValue([]),
    getStatements: vi.fn().mockResolvedValue([]),
    getReceipt: vi.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [BusinessController],
      providers: [{ provide: BusinessService, useValue: service }],
    })
      .overrideGuard(JwtAccessGuard)
      .useValue(new TestAuthGuard())
      .overrideGuard(StoreAccessGuard)
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

  it('keeps product prices as decimal strings at the API boundary', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/stores/store-1/products')
      .send({
        sku: 'PROD-001',
        name: 'Producto Demo',
        unitPrice: '120.0000',
        currency: 'PEN',
      })
      .expect(201);

    expect(service.createProduct).toHaveBeenCalledWith(
      'store-1',
      expect.objectContaining({ unitPrice: '120.0000' }),
      'admin-1',
    );
  });

  it('rejects numeric JSON prices', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/stores/store-1/products')
      .send({ sku: 'PROD-001', name: 'Producto', unitPrice: 120, currency: 'PEN' })
      .expect(400);
    expect(service.createProduct).not.toHaveBeenCalled();
  });

  it('allows operators to read operational data but reserves setup changes for administrators', () => {
    expect(Reflect.getMetadata(STORE_ROLES, BusinessController)).toEqual([
      'STORE_ADMIN',
      'OPERATOR',
    ]);
    expect(Reflect.getMetadata(STORE_ROLES, BusinessController.prototype.createProduct)).toEqual([
      'STORE_ADMIN',
    ]);
  });
});
