import { JwtService } from '@nestjs/jwt';
import { Decimal } from 'decimal.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/database/prisma.service.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { PrismaAuthRepository } from '../src/modules/auth/prisma-auth.repository.js';
import { CreditOperationsService } from '../src/modules/operations/credit-operations.service.js';
import { PrismaCreditOperationsRepository } from '../src/modules/operations/prisma-credit-operations.repository.js';
import { billingCutForDueDate } from '../src/modules/operations/billing-cut.js';

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
    await expect(
      prisma.auditEvent.findMany({
        where: { entityId: { in: [purchase.id, cut.id, payment.id] } },
        select: { event: true },
        orderBy: { createdAt: 'asc' },
      }),
    ).resolves.toEqual([
      { event: 'PURCHASE_CREATED' },
      { event: 'CUT_CREATED' },
      { event: 'PAYMENT_CREATED' },
    ]);
  });

  it('places only the installment due for a monthly cut in its statement', async () => {
    const repository = new PrismaCreditOperationsRepository(prisma);
    const operations = new CreditOperationsService(repository, randomUUID);
    const store = await prisma.store.findUniqueOrThrow({ where: { taxId: '20123456789' } });
    const templateAccount = await prisma.creditAccount.findUniqueOrThrow({
      where: { storeId_accountNumber: { storeId: store.id, accountNumber: 'CC-000001' } },
      include: { conditions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    const templateCondition = templateAccount.conditions[0]!;
    const account = await prisma.creditAccount.create({
      data: {
        storeId: store.id,
        customerId: templateAccount.customerId,
        accountNumber: `INT-${randomUUID()}`,
        currency: templateAccount.currency,
        creditLimit: templateAccount.creditLimit,
        conditions: {
          create: {
            version: 1,
            compensatoryRateKind: templateCondition.compensatoryRateKind,
            compensatoryRate: templateCondition.compensatoryRate,
            lateRateKind: templateCondition.lateRateKind,
            lateRate: templateCondition.lateRate,
            billingDay: templateCondition.billingDay,
            dueDay: templateCondition.dueDay,
            maxInstallments: templateCondition.maxInstallments,
            graceMonths: templateCondition.graceMonths,
            validFrom: templateCondition.validFrom,
          },
        },
      },
    });
    const product = await prisma.productService.findUniqueOrThrow({
      where: { storeId_sku: { storeId: store.id, sku: 'PROD-001' } },
    });
    const key = randomUUID();
    const purchase = await operations.createPurchase({
      storeId: store.id,
      accountId: account.id,
      operatorUserId: '20000000-0000-4000-8000-000000000002',
      idempotencyKey: `installment-purchase-${key}`,
      purchasedAt: '2026-10-20T10:00:00-05:00',
      currency: 'PEN',
      mode: 'INSTALLMENTS',
      installmentCount: 3,
      items: [{ productId: product.id, quantity: '1' }],
    });
    const first = purchase.obligations[0]!;
    const cut = await operations.createCut({
      storeId: store.id,
      accountId: account.id,
      operatorUserId: '20000000-0000-4000-8000-000000000002',
      idempotencyKey: `installment-cut-${key}`,
      cutAt: billingCutForDueDate(first.dueDate, 26),
    });

    expect(cut.obligationIds).toEqual([first.id]);

    for (const [index, obligation] of purchase.obligations.entries()) {
      await operations.createPayment({
        storeId: store.id,
        accountId: account.id,
        operatorUserId: '20000000-0000-4000-8000-000000000002',
        idempotencyKey: `installment-payment-${key}-${index}`,
        paidAt: `${obligation.dueDate}T12:00:00-05:00`,
        currency: 'PEN',
        amount: new Decimal(obligation.amountDue).toFixed(2),
      });
    }
    const refreshedAccount = await prisma.creditAccount.findUniqueOrThrow({
      where: { id_storeId: { id: account.id, storeId: store.id } },
      select: { originalOutstanding: true },
    });
    expect(refreshedAccount.originalOutstanding.toString()).toBe('0');
  });

  it('serializes simultaneous purchases so the credit limit cannot be exceeded', async () => {
    const operations = new CreditOperationsService(
      new PrismaCreditOperationsRepository(prisma),
      randomUUID,
    );
    const store = await prisma.store.findUniqueOrThrow({ where: { taxId: '20123456789' } });
    const account = await prisma.creditAccount.findUniqueOrThrow({
      where: { storeId_accountNumber: { storeId: store.id, accountNumber: 'CC-000001' } },
    });
    const product = await prisma.productService.findUniqueOrThrow({
      where: { storeId_sku: { storeId: store.id, sku: 'PROD-001' } },
    });
    const key = randomUUID();
    const base = {
      storeId: store.id,
      accountId: account.id,
      operatorUserId: '20000000-0000-4000-8000-000000000002',
      purchasedAt: '2026-10-20T10:00:00-05:00',
      currency: 'PEN',
      mode: 'END_OF_MONTH' as const,
      items: [{ productId: product.id, quantity: '20' }],
    };
    const results = await Promise.allSettled([
      operations.createPurchase({ ...base, idempotencyKey: `concurrent-a-${key}` }),
      operations.createPurchase({ ...base, idempotencyKey: `concurrent-b-${key}` }),
    ]);
    const successful = results.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof operations.createPurchase>>> =>
        result.status === 'fulfilled',
    );

    expect(successful).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);

    const obligation = successful[0]!.value.obligations[0]!;
    await operations.createPayment({
      storeId: store.id,
      accountId: account.id,
      operatorUserId: '20000000-0000-4000-8000-000000000002',
      idempotencyKey: `concurrent-cleanup-${key}`,
      paidAt: `${obligation.dueDate}T12:00:00-05:00`,
      currency: 'PEN',
      amount: new Decimal(obligation.amountDue).toFixed(2),
    });
  }, 15_000);
});
import { randomUUID } from 'node:crypto';

