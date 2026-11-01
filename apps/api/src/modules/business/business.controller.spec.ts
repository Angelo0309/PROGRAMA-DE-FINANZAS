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
    deactivateClient: vi.fn().mockResolvedValue({ id: 'client-1', active: false }),
    deactivateProduct: vi.fn().mockResolvedValue({ id: 'product-1', active: false }),
    deactivateAccount: vi.fn().mockResolvedValue({ id: 'account-1', active: false }),
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
        imageUrl: 'https://images.example.com/producto-demo.jpg',
      })
      .expect(201);

    expect(service.createProduct).toHaveBeenCalledWith(
      'store-1',
      expect.objectContaining({
        unitPrice: '120.0000',
        imageUrl: 'https://images.example.com/producto-demo.jpg',
      }),
      'admin-1',
    );
  });

  it('rejects product image URLs that do not use HTTP or HTTPS', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/stores/store-1/products')
      .send({
        sku: 'PROD-FTP',
        name: 'Producto con imagen FTP',
        unitPrice: '25.0000',
        currency: 'PEN',
        imageUrl: 'ftp://files.example.com/producto.jpg',
      })
      .expect(400);

    expect(service.createProduct).not.toHaveBeenCalled();
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

  it('exposes audited logical deletion commands for store administrators', async () => {
    await request(app.getHttpServer())
      .delete('/api/v1/stores/store-1/clients/client-1')
      .expect(200);
    await request(app.getHttpServer())
      .delete('/api/v1/stores/store-1/products/product-1')
      .expect(200);
    await request(app.getHttpServer())
      .delete('/api/v1/stores/store-1/accounts/account-1')
      .expect(200);

    expect(service.deactivateClient).toHaveBeenCalledWith('store-1', 'client-1', 'admin-1');
    expect(service.deactivateProduct).toHaveBeenCalledWith('store-1', 'product-1', 'admin-1');
    expect(service.deactivateAccount).toHaveBeenCalledWith('store-1', 'account-1', 'admin-1');
  });
});
