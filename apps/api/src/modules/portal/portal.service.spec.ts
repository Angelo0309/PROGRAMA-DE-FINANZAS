import { describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../../database/prisma.service.js';
import { PortalService } from './portal.service.js';

describe('PortalService logical deactivation', () => {
  it('lists only active stores', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { store: { findMany } } as unknown as PrismaService;
    const service = new PortalService(prisma);

    await service.listStores();

    expect(findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  });

  it('deactivates a store and its dependent access in one audited transaction', async () => {
    const transaction = {
      store: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      storeAccess: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      customer: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      productService: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      creditAccount: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: vi.fn(async (work: (client: typeof transaction) => unknown) => work(transaction)),
    } as unknown as PrismaService;
    const service = new PortalService(prisma);

    await expect(service.deactivateStore('store-1', 'platform-admin-1')).resolves.toEqual({
      id: 'store-1',
      active: false,
    });
    expect(transaction.storeAccess.updateMany).toHaveBeenCalledWith({
      where: { storeId: 'store-1', active: true },
      data: { active: false },
    });
    expect(transaction.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'platform-admin-1',
        event: 'STORE_DEACTIVATED',
        entityId: 'store-1',
      }),
    });
  });
});
