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

  it('rejects invitations for stores that are not active', async () => {
    const prisma = {
      store: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(),
    } as unknown as PrismaService;
    const service = new PortalService(prisma);

    await expect(service.createInvitation({
      email: 'admin@example.com', platformRole: 'USER', storeId: 'inactive-store',
      storeRole: 'STORE_ADMIN', expiresAt: '2026-12-01T00:00:00.000Z',
    }, 'platform-admin')).rejects.toThrow('La tienda no está activa.');
    expect(prisma.$transaction).not.toHaveBeenCalled();
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

  it('returns the authenticated client payment schedule with official decimal strings', async () => {
    const decimal = (value: string) => ({ toFixed: (places: number) => Number(value).toFixed(places) });
    const findMany = vi.fn().mockResolvedValue([{
      id: 'obligation-1', installmentNumber: 1, dueDate: new Date('2026-12-15T00:00:00.000Z'),
      openingBalance: decimal('1000'), principalDue: decimal('250'),
      compensatoryInterest: decimal('35.25'), lateInterest: decimal('0'),
      amountDue: decimal('285.25'), paidAmount: decimal('0'), status: 'PENDING',
      credit: { accountId: 'account-1', purchaseId: 'purchase-1', currency: 'PEN' },
    }]);
    const service = new PortalService({ obligation: { findMany } } as unknown as PrismaService);

    await expect(service.getMySchedule('client-user-1')).resolves.toEqual([expect.objectContaining({
      id: 'obligation-1', accountId: 'account-1', purchaseId: 'purchase-1', currency: 'PEN',
      dueDate: '2026-12-15', amountDue: '285.25', paidAmount: '0.00', status: 'PENDING',
    })]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { credit: { account: { customer: { userId: 'client-user-1' } } } },
    }));
  });

  it('returns only payments owned by the authenticated client with their allocations', async () => {
    const decimal = (value: string) => ({ toFixed: (places: number) => Number(value).toFixed(places) });
    const findMany = vi.fn().mockResolvedValue([{
      id: 'payment-1', accountId: 'account-1', paidAt: new Date('2026-11-01T15:30:00.000Z'),
      currency: 'PEN', amount: decimal('285.25'), method: 'BANK_TRANSFER', receiptNumber: 'REC-001',
      details: [{ obligationId: 'obligation-1', lateInterestPaid: decimal('0'), compensatoryPaid: decimal('35.25'), principalPaid: decimal('250') }],
    }]);
    const service = new PortalService({ payment: { findMany } } as unknown as PrismaService);

    await expect(service.getMyPayments('client-user-1')).resolves.toEqual([expect.objectContaining({
      id: 'payment-1', amount: '285.25', receiptNumber: 'REC-001', allocations: [{
        obligationId: 'obligation-1', lateInterestPaid: '0.00', compensatoryPaid: '35.25', principalPaid: '250.00',
      }],
    })]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { account: { customer: { userId: 'client-user-1' } } },
    }));
  });
});
