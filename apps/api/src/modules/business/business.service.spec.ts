import { describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../../database/prisma.service.js';
import { BusinessService } from './business.service.js';

describe('BusinessService logical deactivation', () => {
  it('deactivates a client and its active accounts in the same audited transaction', async () => {
    const transaction = {
      customer: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      creditAccount: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: vi.fn(async (work: (client: typeof transaction) => unknown) => work(transaction)),
    } as unknown as PrismaService;
    const service = new BusinessService(prisma);

    await expect(service.deactivateClient('store-1', 'client-1', 'admin-1')).resolves.toEqual({
      id: 'client-1',
      active: false,
    });
    expect(transaction.creditAccount.updateMany).toHaveBeenCalledWith({
      where: { customerId: 'client-1', storeId: 'store-1', active: true },
      data: { active: false },
    });
    expect(transaction.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        storeId: 'store-1',
        userId: 'admin-1',
        event: 'CLIENT_DEACTIVATED',
        entityId: 'client-1',
      }),
    });
  });
});

describe('BusinessService account conditions', () => {
  it('returns the latest credit condition with decimal rates as strings', async () => {
    const prisma = {
      creditAccount: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'account-1',
          accountNumber: 'CC-001',
          customerId: 'client-1',
          currency: 'PEN',
          creditLimit: { toFixed: () => '2000.00' },
          originalOutstanding: { toFixed: () => '600.00' },
          customer: { fullName: 'Pedro Torres' },
          conditions: [{
            id: 'condition-2',
            version: 2,
            compensatoryRateKind: 'EFFECTIVE_ANNUAL',
            compensatoryRate: { toFixed: () => '0.240000000000' },
            lateRateKind: 'EFFECTIVE_ANNUAL',
            lateRate: { toFixed: () => '0.360000000000' },
            billingDay: 20,
            dueDay: 28,
            maxInstallments: 6,
            graceMonths: 0,
            validFrom: new Date('2026-11-01T05:00:00.000Z'),
            validUntil: null,
          }],
        }]),
      },
    } as unknown as PrismaService;
    const service = new BusinessService(prisma);

    await expect(service.listAccounts('store-1')).resolves.toEqual([expect.objectContaining({
      id: 'account-1',
      customerName: 'Pedro Torres',
      currentCondition: {
        id: 'condition-2',
        version: 2,
        compensatoryRateKind: 'EFFECTIVE_ANNUAL',
        compensatoryRate: '0.240000000000',
        lateRateKind: 'EFFECTIVE_ANNUAL',
        lateRate: '0.360000000000',
        billingDay: 20,
        dueDay: 28,
        maxInstallments: 6,
        graceMonths: 0,
        validFrom: '2026-11-01T05:00:00.000Z',
        validUntil: null,
      },
    })]);
    expect(prisma.creditAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        conditions: { orderBy: { version: 'desc' }, take: 1 },
      }),
    }));
  });

  it('creates the account and its initial condition in one transaction', async () => {
    const transaction = {
      customer: { findUnique: vi.fn().mockResolvedValue({ id: 'client-1', active: true }) },
      creditAccount: { create: vi.fn().mockResolvedValue({ id: 'account-2', accountNumber: 'CC-002', customerId: 'client-1', currency: 'PEN', creditLimit: { toFixed: () => '2000.00' }, originalOutstanding: { toFixed: () => '0.00' } }) },
      creditCondition: { create: vi.fn().mockResolvedValue({ id: 'condition-2', version: 1, compensatoryRateKind: 'EFFECTIVE_ANNUAL', compensatoryRate: { toFixed: () => '0.240000000000' }, lateRateKind: 'EFFECTIVE_ANNUAL', lateRate: { toFixed: () => '0.360000000000' }, billingDay: 20, dueDay: 28, maxInstallments: 6, graceMonths: 0, validFrom: new Date('2026-11-01T05:00:00.000Z'), validUntil: null }) },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: vi.fn(async (work: (client: typeof transaction) => unknown) => work(transaction)) } as unknown as PrismaService;
    const service = new BusinessService(prisma);

    const result = await service.createAccount('store-1', {
      customerId: 'client-1',
      accountNumber: 'CC-002',
      currency: 'PEN',
      creditLimit: '2000.00',
      initialCondition: {
        compensatoryRateKind: 'EFFECTIVE_ANNUAL',
        compensatoryRate: '0.24',
        lateRateKind: 'EFFECTIVE_ANNUAL',
        lateRate: '0.36',
        billingDay: 20,
        dueDay: 28,
        maxInstallments: 6,
        graceMonths: 0,
        validFrom: '2026-11-01T00:00:00-05:00',
      },
    }, 'admin-1');

    expect(transaction.creditCondition.create).toHaveBeenCalledWith({ data: expect.objectContaining({ accountId: 'account-2', version: 1 }) });
    expect(result).toEqual(expect.objectContaining({ id: 'account-2', currentCondition: expect.objectContaining({ id: 'condition-2' }) }));
  });
});

describe('BusinessService payment schedule', () => {
  it('returns purchase metadata in the selected account schedule', async () => {
    const decimal = (value: string) => ({
      toFixed: (places: number) => Number(value).toFixed(places),
    });
    const findMany = vi.fn().mockResolvedValue([{
      id: 'obligation-1',
      installmentNumber: 1,
      dueDate: new Date('2026-11-28T00:00:00.000Z'),
      openingBalance: decimal('100'),
      principalDue: decimal('95'),
      compensatoryInterest: decimal('5'),
      lateInterest: decimal('0'),
      amountDue: decimal('100'),
      paidAmount: decimal('0'),
      status: 'PENDING',
      credit: {
        purchaseId: 'purchase-1',
        currency: 'PEN',
        purchase: { purchasedAt: new Date('2026-10-20T15:00:00.000Z') },
      },
    }]);
    const service = new BusinessService({
      obligation: { findMany },
    } as unknown as PrismaService);

    await expect(service.getSchedule('store-1', 'account-1')).resolves.toEqual([
      expect.objectContaining({
        purchaseId: 'purchase-1',
        purchasedAt: '2026-10-20T15:00:00.000Z',
      }),
    ]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { credit: { storeId: 'store-1', accountId: 'account-1' } },
      include: {
        credit: {
          select: {
            purchaseId: true,
            currency: true,
            purchase: { select: { purchasedAt: true } },
          },
        },
      },
    }));
  });
});

describe('BusinessService payment quote', () => {
  it('calculates the complete payable amount for the selected Lima payment date', async () => {
    const prisma = {
      creditAccount: { findFirst: vi.fn().mockResolvedValue({ id: 'account-1', currency: 'PEN' }) },
      obligation: { findMany: vi.fn().mockResolvedValue([{
        id: 'obligation-1',
        dueDate: new Date('2026-10-28T00:00:00.000Z'),
        amountDue: { toString: () => '100.000000000000' },
        compensatoryInterest: { toString: () => '5.000000000000' },
        principalDue: { toString: () => '95.000000000000' },
        credit: { lateDailyRate: { toString: () => '0.001000000000000' } },
      }]) },
    } as unknown as PrismaService;
    const service = new BusinessService(prisma);

    const quote = await (service as unknown as {
      getPaymentQuote(storeId: string, accountId: string, paidAt: string): Promise<unknown>;
    }).getPaymentQuote('store-1', 'account-1', '2026-10-30T10:00:00-05:00');

    expect(quote).toEqual({
      accountId: 'account-1',
      paidOn: '2026-10-30',
      currency: 'PEN',
      amount: '100.20',
      obligations: [{
        id: 'obligation-1',
        dueDate: '2026-10-28',
        lateDays: 2,
        lateInterest: '0.20',
        compensatoryInterest: '5.00',
        principal: '95.00',
      }],
    });
  });
});
