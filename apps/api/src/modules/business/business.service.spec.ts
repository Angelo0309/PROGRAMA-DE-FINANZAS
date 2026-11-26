import { describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../../database/prisma.service.js';
import { BusinessService } from './business.service.js';

describe('BusinessService client portal invitations', () => {
  it('creates a one-time CLIENT invitation tied to the selected customer', async () => {
    const transaction = {
      customer: {
        findFirst: vi.fn().mockResolvedValue({ id: 'client-1', userId: null }),
      },
      user: { findUnique: vi.fn().mockResolvedValue(null) },
      userInvitation: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 'invitation-1',
          email: 'maria@example.com',
          expiresAt: new Date('2026-12-02T15:00:00.000Z'),
        }),
      },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: vi.fn(async (work: (client: typeof transaction) => unknown) => work(transaction)),
    } as unknown as PrismaService;
    const service = new BusinessService(prisma);

    const result = await service.createClientInvitation(
      'store-1',
      'client-1',
      { email: 'maria@example.com', expiresAt: '2026-12-02T10:00:00-05:00' },
      'admin-1',
      new Date('2026-11-25T15:00:00.000Z'),
    );

    expect(result).toEqual({
      id: 'invitation-1',
      email: 'maria@example.com',
      token: expect.any(String),
      expiresAt: '2026-12-02T15:00:00.000Z',
    });
    expect(transaction.userInvitation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: 'client-1',
        storeId: 'store-1',
        storeRole: 'CLIENT',
        platformRole: 'USER',
        issuedById: 'admin-1',
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    });
    expect(transaction.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event: 'CLIENT_INVITATION_CREATED',
        entityId: 'invitation-1',
      }),
    });
  });

  it('rejects an invitation when the customer already has portal access', async () => {
    const transaction = {
      customer: {
        findFirst: vi.fn().mockResolvedValue({ id: 'client-1', userId: 'user-1' }),
      },
      userInvitation: { findFirst: vi.fn(), create: vi.fn() },
      auditEvent: { create: vi.fn() },
    };
    const service = new BusinessService({
      $transaction: vi.fn(async (work: (client: typeof transaction) => unknown) => work(transaction)),
    } as unknown as PrismaService);

    await expect(service.createClientInvitation(
      'store-1',
      'client-1',
      { email: 'maria@example.com', expiresAt: '2026-12-02T10:00:00-05:00' },
      'admin-1',
    )).rejects.toThrow('El cliente ya tiene acceso al portal.');
    expect(transaction.userInvitation.create).not.toHaveBeenCalled();
  });

  it('rejects an invitation email that already belongs to a registered user', async () => {
    const transaction = {
      customer: {
        findFirst: vi.fn().mockResolvedValue({ id: 'client-1', userId: null }),
      },
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'another-user' }) },
      userInvitation: { findFirst: vi.fn(), create: vi.fn() },
      auditEvent: { create: vi.fn() },
    };
    const service = new BusinessService({
      $transaction: vi.fn(async (work: (client: typeof transaction) => unknown) => work(transaction)),
    } as unknown as PrismaService);

    await expect(service.createClientInvitation(
      'store-1',
      'client-1',
      { email: 'used@example.com', expiresAt: '2026-12-02T10:00:00-05:00' },
      'admin-1',
      new Date('2026-11-25T15:00:00.000Z'),
    )).rejects.toThrow('El correo ya pertenece a un usuario registrado.');
    expect(transaction.userInvitation.create).not.toHaveBeenCalled();
  });
});

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
      toString: () => value,
    });
    const findMany = vi.fn().mockResolvedValue([{
      id: 'obligation-1',
      installmentNumber: 1,
      dueDate: new Date('2026-10-26T00:00:00.000Z'),
      openingBalance: decimal('1207.913395534745'),
      principalDue: decimal('95'),
      compensatoryInterest: decimal('5'),
      lateInterest: decimal('0'),
      amountDue: decimal('100'),
      paidAmount: decimal('0'),
      status: 'PENDING',
      credit: {
        purchaseId: 'purchase-1',
        principal: decimal('1200'),
        currency: 'PEN',
        purchase: {
          mode: 'INSTALLMENTS',
          purchasedAt: new Date('2026-09-15T15:00:00.000Z'),
        },
      },
    }]);
    const service = new BusinessService({
      obligation: { findMany },
    } as unknown as PrismaService);

    await expect(service.getSchedule('store-1', 'account-1')).resolves.toEqual([
      expect.objectContaining({
        purchaseId: 'purchase-1',
        purchasedAt: '2026-09-15T15:00:00.000Z',
        capitalization: {
          startDate: '2026-09-15',
          endDate: '2026-09-26',
          days: 11,
          originalPrincipal: '1200.00',
          capitalizedInterest: '7.91',
          capitalizedPrincipal: '1207.91',
        },
      }),
    ]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { credit: { storeId: 'store-1', accountId: 'account-1' } },
      include: {
        credit: {
          select: {
            purchaseId: true,
            principal: true,
            currency: true,
            purchase: { select: { mode: true, purchasedAt: true } },
          },
        },
      },
    }));
  });

  it('does not describe French capitalization for an end-of-month purchase', async () => {
    const decimal = (value: string) => ({
      toFixed: (places: number) => Number(value).toFixed(places),
      toString: () => value,
    });
    const service = new BusinessService({
      obligation: { findMany: vi.fn().mockResolvedValue([{
        id: 'obligation-1', installmentNumber: 1,
        dueDate: new Date('2026-10-05T00:00:00.000Z'),
        openingBalance: decimal('120'), principalDue: decimal('120'),
        compensatoryInterest: decimal('1.08'), lateInterest: decimal('0'),
        amountDue: decimal('121.08'), paidAmount: decimal('0'), status: 'PENDING',
        credit: {
          purchaseId: 'purchase-1', principal: decimal('120'), currency: 'PEN',
          purchase: {
            mode: 'END_OF_MONTH',
            purchasedAt: new Date('2026-09-20T15:00:00.000Z'),
          },
        },
      }]) },
    } as unknown as PrismaService);

    await expect(service.getSchedule('store-1', 'account-1')).resolves.toEqual([
      expect.objectContaining({ capitalization: null }),
    ]);
  });

  it('shows an unpaid obligation as overdue after its due date without changing paid rows', async () => {
    const decimal = (value: string) => ({
      toFixed: (places: number) => Number(value).toFixed(places),
    });
    const obligation = (id: string, dueDate: string, status: string) => ({
      id,
      installmentNumber: 1,
      dueDate: new Date(`${dueDate}T00:00:00.000Z`),
      openingBalance: decimal('100'),
      principalDue: decimal('95'),
      compensatoryInterest: decimal('5'),
      lateInterest: decimal('0'),
      amountDue: decimal('100'),
      paidAmount: decimal(status === 'PAID' ? '100' : '0'),
      status,
      credit: {
        purchaseId: `purchase-${id}`,
        currency: 'PEN',
        purchase: { purchasedAt: new Date('2026-10-20T15:00:00.000Z') },
      },
    });
    const service = new BusinessService({
      obligation: {
        findMany: vi.fn().mockResolvedValue([
          obligation('overdue', '2026-11-24', 'PENDING'),
          obligation('today', '2026-11-25', 'PENDING'),
          obligation('paid', '2026-11-20', 'PAID'),
        ]),
      },
    } as unknown as PrismaService);

    const result = await service.getSchedule(
      'store-1',
      'account-1',
      new Date('2026-11-25T15:00:00.000Z'),
    );

    expect(result.map((item) => [item.id, item.status])).toEqual([
      ['overdue', 'OVERDUE'],
      ['today', 'PENDING'],
      ['paid', 'PAID'],
    ]);
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
