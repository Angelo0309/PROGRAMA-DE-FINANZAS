import type { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JwtAccessGuard, StoreAccessGuard } from '../auth/auth.guards.js';
import { CreditOperationsService } from './credit-operations.service.js';
import { OperationsController } from './operations.controller.js';

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    context.switchToHttp().getRequest().user = {
      sub: 'operator-1',
      platformRole: 'USER',
      email: 'operator@example.com',
    };
    return true;
  }
}

describe('OperationsController', () => {
  let app: INestApplication;
  const service = {
    createPurchase: vi.fn().mockResolvedValue({
      id: 'purchase-1',
      currency: 'PEN',
      total: '100.00',
      obligations: [],
    }),
    createCut: vi.fn().mockResolvedValue({ id: 'cut-1', totalDue: '100.00' }),
    createPayment: vi.fn().mockResolvedValue({
      id: 'payment-1',
      amount: '100.00',
      receiptNumber: 'RC-1',
    }),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [OperationsController],
      providers: [{ provide: CreditOperationsService, useValue: service }],
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

  it('takes the idempotency key from the header and operator from JWT', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/stores/store-1/purchases')
      .set('Idempotency-Key', 'purchase-key-1')
      .send({
        accountId: 'account-1',
        purchasedAt: '2026-10-20T10:00:00-05:00',
        currency: 'PEN',
        mode: 'END_OF_MONTH',
        items: [{ productId: 'product-1', quantity: '1' }],
      })
      .expect(201);

    expect(service.createPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 'store-1',
        operatorUserId: 'operator-1',
        idempotencyKey: 'purchase-key-1',
      }),
    );
  });

  it('requires an idempotency key for critical commands', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/accounts/account-1/payments')
      .send({
        storeId: 'store-1',
        paidAt: '2026-11-05T12:00:00-05:00',
        currency: 'PEN',
        amount: '100.00',
      })
      .expect(400);
    expect(service.createPayment).not.toHaveBeenCalled();
  });
});
