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
