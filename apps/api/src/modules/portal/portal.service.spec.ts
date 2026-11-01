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

  it('returns purchase items with each current product image URL', async () => {
    const decimal = (value: string) => ({
      toFixed: (places: number) => Number(value).toFixed(places),
    });
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'purchase-1',
        accountId: 'account-1',
        purchasedAt: new Date('2026-10-20T15:00:00.000Z'),
        mode: 'END_OF_MONTH',
        currency: 'PEN',
        total: decimal('76.50'),
        status: 'ACTIVE',
        details: [
          {
            productId: 'product-1',
            description: 'Producto con imagen',
            quantity: decimal('2'),
            unitPrice: decimal('25.50'),
            lineTotal: decimal('51'),
            product: { imageUrl: 'https://images.example.com/producto.jpg' },
          },
          {
            productId: 'service-1',
            description: 'Servicio sin imagen',
            quantity: decimal('1'),
            unitPrice: decimal('25.50'),
            lineTotal: decimal('25.50'),
            product: { imageUrl: null },
          },
        ],
      },
    ]);
    const prisma = { purchase: { findMany } } as unknown as PrismaService;
    const service = new PortalService(prisma);

    await expect(service.getMyPurchases('client-user-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'purchase-1',
        total: '76.50',
        items: [
          {
            productId: 'product-1',
            description: 'Producto con imagen',
            quantity: '2.0000',
            unitPrice: '25.5000',
            lineTotal: '51.00',
            imageUrl: 'https://images.example.com/producto.jpg',
          },
          {
            productId: 'service-1',
            description: 'Servicio sin imagen',
            quantity: '1.0000',
            unitPrice: '25.5000',
            lineTotal: '25.50',
            imageUrl: null,
          },
        ],
      }),
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          details: {
            include: { product: { select: { imageUrl: true } } },
            orderBy: { id: 'asc' },
          },
        },
      }),
    );
  });
});
