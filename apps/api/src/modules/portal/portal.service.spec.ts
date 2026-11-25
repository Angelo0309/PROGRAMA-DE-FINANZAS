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

  it('lists platform users with every store role and without authentication secrets', async () => {
    const findMany = vi.fn().mockResolvedValue([{
      id: 'user-1',
      username: 'admin.negocio',
      email: 'admin@example.com',
      displayName: 'Administradora Demo',
      platformRole: 'USER',
      active: true,
      createdAt: new Date('2026-11-01T10:00:00.000Z'),
      passwordHash: 'must-never-leave-the-api',
      accesses: [
        { storeId: 'store-1', role: 'STORE_ADMIN', active: true, store: { name: 'Bodega Norte' } },
        { storeId: 'store-2', role: 'OPERATOR', active: false, store: { name: 'Bodega Sur' } },
      ],
    }]);
    const service = new PortalService({ user: { findMany } } as unknown as PrismaService);

    const users = await service.listUsers();

    expect(users).toEqual([{
      id: 'user-1',
      username: 'admin.negocio',
      email: 'admin@example.com',
      displayName: 'Administradora Demo',
      platformRole: 'USER',
      active: true,
      createdAt: '2026-11-01T10:00:00.000Z',
      storeAccesses: [
        { storeId: 'store-1', storeName: 'Bodega Norte', role: 'STORE_ADMIN', active: true },
        { storeId: 'store-2', storeName: 'Bodega Sur', role: 'OPERATOR', active: false },
      ],
    }]);
    expect(users[0]).not.toHaveProperty('passwordHash');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { displayName: 'asc' },
      select: expect.objectContaining({
        passwordHash: false,
        accesses: expect.objectContaining({
          orderBy: { createdAt: 'asc' },
        }),
      }),
    }));
  });

  it('lists invitation history with an effective expired status and no token hash', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'invitation-expired', email: 'expired@example.com', platformRole: 'USER',
        storeRole: 'STORE_ADMIN', status: 'PENDING',
        expiresAt: new Date('2026-11-22T23:59:59.000Z'), acceptedAt: null,
        createdAt: new Date('2026-11-20T10:00:00.000Z'),
        store: { id: 'store-1', name: 'Bodega Norte' },
        issuedBy: { id: 'admin-1', displayName: 'Admin Plataforma' },
        tokenHash: 'must-never-leave-the-api',
      },
      {
        id: 'invitation-used', email: 'used@example.com', platformRole: 'USER',
        storeRole: 'OPERATOR', status: 'ACCEPTED',
        expiresAt: new Date('2026-11-30T00:00:00.000Z'),
        acceptedAt: new Date('2026-11-21T12:00:00.000Z'),
        createdAt: new Date('2026-11-20T11:00:00.000Z'),
        store: { id: 'store-1', name: 'Bodega Norte' },
        issuedBy: { id: 'admin-1', displayName: 'Admin Plataforma' },
      },
    ]);
    const service = new PortalService({ userInvitation: { findMany } } as unknown as PrismaService);

    const invitations = await service.listInvitations(new Date('2026-11-23T10:00:00.000Z'));

    expect(invitations).toEqual([
      expect.objectContaining({ id: 'invitation-expired', status: 'EXPIRED' }),
      expect.objectContaining({
        id: 'invitation-used', status: 'ACCEPTED', acceptedAt: '2026-11-21T12:00:00.000Z',
      }),
    ]);
    expect(invitations[0]).not.toHaveProperty('tokenHash');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { createdAt: 'desc' },
      select: expect.objectContaining({ tokenHash: false }),
    }));
  });

  it('revokes a current pending invitation and records the actor in audit', async () => {
    const now = new Date('2026-11-23T10:00:00.000Z');
    const transaction = {
      userInvitation: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ storeId: 'store-1' }),
      },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: vi.fn(async (work: (client: typeof transaction) => unknown) => work(transaction)),
    } as unknown as PrismaService;
    const service = new PortalService(prisma);

    await expect(service.revokeInvitation('invitation-1', 'platform-admin-1', now)).resolves.toEqual({
      id: 'invitation-1', status: 'REVOKED',
    });
    expect(transaction.userInvitation.updateMany).toHaveBeenCalledWith({
      where: { id: 'invitation-1', status: 'PENDING', expiresAt: { gt: now } },
      data: { status: 'REVOKED' },
    });
    expect(transaction.auditEvent.create).toHaveBeenCalledWith({
      data: {
        userId: 'platform-admin-1', storeId: 'store-1', event: 'USER_INVITATION_REVOKED',
        entity: 'INVITACION_USUARIO', entityId: 'invitation-1',
      },
    });
  });

  it('rejects revocation when the invitation is not pending and unexpired', async () => {
    const transaction = {
      userInvitation: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: vi.fn(),
      },
      auditEvent: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (work: (client: typeof transaction) => unknown) => work(transaction)),
    } as unknown as PrismaService;
    const service = new PortalService(prisma);

    await expect(service.revokeInvitation(
      'invitation-used', 'platform-admin-1', new Date('2026-11-23T10:00:00.000Z'),
    )).rejects.toThrow('La invitación ya no puede revocarse.');
    expect(transaction.userInvitation.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(transaction.auditEvent.create).not.toHaveBeenCalled();
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
      credit: {
        accountId: 'account-1',
        purchaseId: 'purchase-1',
        currency: 'PEN',
        purchase: { purchasedAt: new Date('2026-10-20T15:00:00.000Z') },
      },
    }]);
    const service = new PortalService({ obligation: { findMany } } as unknown as PrismaService);

    await expect(service.getMySchedule('client-user-1')).resolves.toEqual([expect.objectContaining({
      id: 'obligation-1', accountId: 'account-1', purchaseId: 'purchase-1',
      purchasedAt: '2026-10-20T15:00:00.000Z', currency: 'PEN',
      dueDate: '2026-12-15', amountDue: '285.25', paidAmount: '0.00', status: 'PENDING',
    })]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { credit: { account: { customer: { userId: 'client-user-1' } } } },
      include: {
        credit: {
          select: {
            accountId: true,
            purchaseId: true,
            currency: true,
            purchase: { select: { purchasedAt: true } },
          },
        },
      },
    }));
  });

  it('shows a client pending installment as overdue after its due date', async () => {
    const decimal = (value: string) => ({ toFixed: (places: number) => Number(value).toFixed(places) });
    const findMany = vi.fn().mockResolvedValue([{
      id: 'obligation-overdue', installmentNumber: 1, dueDate: new Date('2026-11-24T00:00:00.000Z'),
      openingBalance: decimal('100'), principalDue: decimal('95'),
      compensatoryInterest: decimal('5'), lateInterest: decimal('0'),
      amountDue: decimal('100'), paidAmount: decimal('0'), status: 'PENDING',
      credit: {
        accountId: 'account-1', purchaseId: 'purchase-1', currency: 'PEN',
        purchase: { purchasedAt: new Date('2026-10-20T15:00:00.000Z') },
      },
    }]);
    const service = new PortalService({ obligation: { findMany } } as unknown as PrismaService);

    await expect(service.getMySchedule(
      'client-user-1',
      new Date('2026-11-25T15:00:00.000Z'),
    )).resolves.toEqual([expect.objectContaining({
      id: 'obligation-overdue',
      status: 'OVERDUE',
    })]);
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
