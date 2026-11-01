import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../database/prisma.service.js';
import type { CreditOperationsService } from './credit-operations.service.js';
import { CutScheduler } from './cut.scheduler.js';

describe('CutScheduler', () => {
  it('exposes overdue cuts with deterministic idempotency keys', async () => {
    const prisma = {
      purchase: {
        findMany: vi.fn().mockResolvedValue([
          {
            storeId: 'store-1',
            accountId: 'account-1',
            assignedCutAt: new Date('2026-10-26T04:59:59.000Z'),
            mode: 'END_OF_MONTH',
            condition: { billingDay: 26 },
            credit: { obligations: [] },
          },
        ]),
      },
    } as unknown as PrismaService;
    const operations = {
      createCut: vi.fn().mockResolvedValue({ id: 'cut-1' }),
    } as unknown as CreditOperationsService;
    const scheduler = new CutScheduler(prisma, operations);

    await scheduler.runDueCuts(new Date('2026-10-31T15:00:00.000Z'));

    expect(operations.createCut).toHaveBeenCalledWith({
      storeId: 'store-1',
      accountId: 'account-1',
      cutAt: '2026-10-26T04:59:59.000Z',
      idempotencyKey: 'auto:account-1:2026-10-26T04:59:59.000Z',
    });
  });

  it('schedules the monthly cut associated with an installment due date', async () => {
    const prisma = {
      purchase: {
        findMany: vi.fn().mockResolvedValue([
          {
            storeId: 'store-1',
            accountId: 'account-1',
            assignedCutAt: new Date('2026-10-27T04:59:59.000Z'),
            mode: 'INSTALLMENTS',
            condition: { billingDay: 26 },
            credit: { obligations: [{ dueDate: new Date('2026-12-05T00:00:00.000Z') }] },
          },
        ]),
      },
    } as unknown as PrismaService;
    const operations = {
      createCut: vi.fn().mockResolvedValue({ id: 'cut-1' }),
    } as unknown as CreditOperationsService;

    await new CutScheduler(prisma, operations).runDueCuts(
      new Date('2026-11-30T12:00:00.000Z'),
    );

    expect(operations.createCut).toHaveBeenCalledWith({
      storeId: 'store-1',
      accountId: 'account-1',
      cutAt: '2026-11-27T04:59:59.000Z',
      idempotencyKey: 'auto:account-1:2026-11-27T04:59:59.000Z',
    });
  });
});
