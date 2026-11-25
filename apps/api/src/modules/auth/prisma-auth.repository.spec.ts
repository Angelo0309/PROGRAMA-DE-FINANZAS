import { describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../../database/prisma.service.js';
import { PrismaAuthRepository } from './prisma-auth.repository.js';

describe('PrismaAuthRepository client invitation activation', () => {
  it('links the invited customer to the new user in the activation transaction', async () => {
    const transaction = {
      userInvitation: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'invitation-1',
          email: 'maria@example.com',
          platformRole: 'USER',
          storeId: 'store-1',
          storeRole: 'CLIENT',
          customerId: 'client-1',
          status: 'PENDING',
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      user: {
        create: vi.fn().mockResolvedValue({
          id: 'user-1',
          username: 'maria',
          email: 'maria@example.com',
          displayName: 'María Demo',
          passwordHash: 'hash',
          platformRole: 'USER',
          active: true,
        }),
      },
      storeAccess: { create: vi.fn().mockResolvedValue({}) },
      customer: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      $transaction: vi.fn(async (work: (client: typeof transaction) => unknown) => work(transaction)),
    } as unknown as PrismaService;
    const repository = new PrismaAuthRepository(prisma);

    await repository.activateInvitation({
      invitationTokenHash: 'token-hash',
      username: 'maria',
      displayName: 'María Demo',
      passwordHash: 'hash',
      acceptedAt: new Date('2026-11-25T15:00:00.000Z'),
    });

    expect(transaction.customer.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'client-1',
        storeId: 'store-1',
        active: true,
        userId: null,
      },
      data: { userId: 'user-1' },
    });
    expect(transaction.storeAccess.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', storeId: 'store-1', role: 'CLIENT' },
    });
  });

  it('aborts activation when the selected customer can no longer be linked', async () => {
    const transaction = {
      userInvitation: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'invitation-1',
          email: 'maria@example.com',
          platformRole: 'USER',
          storeId: 'store-1',
          storeRole: 'CLIENT',
          customerId: 'client-1',
          status: 'PENDING',
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      user: {
        create: vi.fn().mockResolvedValue({
          id: 'user-1', username: 'maria', email: 'maria@example.com', displayName: 'María Demo',
          passwordHash: 'hash', platformRole: 'USER', active: true,
        }),
      },
      storeAccess: { create: vi.fn().mockResolvedValue({}) },
      customer: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
    const repository = new PrismaAuthRepository({
      $transaction: vi.fn(async (work: (client: typeof transaction) => unknown) => work(transaction)),
    } as unknown as PrismaService);

    await expect(repository.activateInvitation({
      invitationTokenHash: 'token-hash',
      username: 'maria',
      displayName: 'María Demo',
      passwordHash: 'hash',
      acceptedAt: new Date('2026-11-25T15:00:00.000Z'),
    })).rejects.toThrow('Customer is no longer available for invitation');
  });
});
