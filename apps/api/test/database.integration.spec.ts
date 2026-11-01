import { JwtService } from '@nestjs/jwt';
import { Decimal } from 'decimal.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/database/prisma.service.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { PrismaAuthRepository } from '../src/modules/auth/prisma-auth.repository.js';
import { CreditOperationsService } from '../src/modules/operations/credit-operations.service.js';
import { PrismaCreditOperationsRepository } from '../src/modules/operations/prisma-credit-operations.repository.js';

const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;

integration('MariaDB integration', () => {
  let prisma: PrismaService;

  beforeAll(() => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    prisma = new PrismaService();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('loads the fictitious seed and authenticates its business administrator', async () => {
    await expect(prisma.store.count()).resolves.toBeGreaterThanOrEqual(1);
    await expect(prisma.user.count()).resolves.toBeGreaterThanOrEqual(3);

    const auth = new AuthService(
      new PrismaAuthRepository(prisma),
      new JwtService(),
      {
        accessTokenSecret: 'integration-secret-with-at-least-32-characters',
        accessTokenTtlSeconds: 900,
        refreshTokenTtlSeconds: 3_600,
      },
    );
    const tokens = await auth.login({
      identifier: 'negocio@credicuenta.test',
      password: 'DemoSegura#2026',
    });
    expect(tokens.accessToken).toBeTypeOf('string');
    await auth.logout(tokens.refreshToken);
    await expect(auth.refresh(tokens.refreshToken)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('persists an idempotent purchase, cut and full payment transactionally', async () => {
    const repository = new PrismaCreditOperationsRepository(prisma);
    const operations = new CreditOperationsService(repository, randomUUID);
    const store = await prisma.store.findUniqueOrThrow({
      where: { taxId: '20123456789' },
    });
    const account = await prisma.creditAccount.findUniqueOrThrow({
      where: {
        storeId_accountNumber: {
          storeId: store.id,
          accountNumber: 'CC-000001',
        },
      },
    });
    const product = await prisma.productService.findUniqueOrThrow({
      where: { storeId_sku: { storeId: store.id, sku: 'PROD-001' } },
    });

    const purchaseInput = {
      storeId: store.id,
      accountId: account.id,
      operatorUserId: '20000000-0000-4000-8000-000000000002',
      idempotencyKey: 'integration-purchase-1',
      purchasedAt: '2026-10-20T10:00:00-05:00',
      currency: 'PEN',
      mode: 'END_OF_MONTH' as const,
      items: [{ productId: product.id, quantity: '1' }],
    };
    const purchase = await operations.createPurchase(purchaseInput);
    expect((await operations.createPurchase(purchaseInput)).id).toBe(purchase.id);

    const cut = await operations.createCut({
      storeId: store.id,
      accountId: account.id,
      idempotencyKey: 'integration-cut-1',
      cutAt: purchase.assignedCutAt,
    });
    expect(cut.obligationIds).toContain(purchase.obligations[0]!.id);

    const obligation = purchase.obligations[0]!;
    const payment = await operations.createPayment({
      storeId: store.id,
      accountId: account.id,
      operatorUserId: '20000000-0000-4000-8000-000000000002',
      idempotencyKey: 'integration-payment-1',
      paidAt: `${obligation.dueDate}T12:00:00-05:00`,
      currency: 'PEN',
      amount: new Decimal(obligation.amountDue).toFixed(2),
    });
    expect(payment.amount).toBe(new Decimal(obligation.amountDue).toFixed(2));
    expect(
      (await operations.createPayment({
        storeId: store.id,
        accountId: account.id,
        operatorUserId: '20000000-0000-4000-8000-000000000002',
        idempotencyKey: 'integration-payment-1',
        paidAt: `${obligation.dueDate}T12:00:00-05:00`,
        currency: 'PEN',
        amount: payment.amount,
      })).id,
    ).toBe(payment.id);
  });
});
import { randomUUID } from 'node:crypto';

