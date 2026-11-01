import { createHash, randomBytes } from 'node:crypto';

import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class PortalService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        accesses: {
          where: { active: true },
          include: { store: { select: { name: true, currency: true } } },
        },
      },
    });
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      platformRole: user.platformRole,
      storeAccesses: user.accesses.map((access) => ({
        storeId: access.storeId,
        storeName: access.store.name,
        currency: access.store.currency,
        role: access.role,
      })),
    };
  }

  listStores() {
    return this.prisma.store.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  }

  async createStore(
    input: {
      taxId: string;
      name: string;
      tradeName?: string;
      currency: string;
      timeZone: string;
    },
    actorId: string,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const store = await transaction.store.create({ data: input });
      await transaction.auditEvent.create({
        data: {
          userId: actorId,
          storeId: store.id,
          event: 'STORE_CREATED',
          entity: 'TIENDA',
          entityId: store.id,
        },
      });
      return store;
    });
  }

  deactivateStore(storeId: string, actorId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.store.updateMany({
        where: { id: storeId, active: true },
        data: { active: false },
      });
      if (result.count === 0) throw new NotFoundException('Tienda no encontrada.');
      await Promise.all([
        transaction.storeAccess.updateMany({
          where: { storeId, active: true },
          data: { active: false },
        }),
        transaction.customer.updateMany({
          where: { storeId, active: true },
          data: { active: false },
        }),
        transaction.productService.updateMany({
          where: { storeId, active: true },
          data: { active: false },
        }),
        transaction.creditAccount.updateMany({
          where: { storeId, active: true },
          data: { active: false },
        }),
      ]);
      await transaction.auditEvent.create({
        data: {
          storeId,
          userId: actorId,
          event: 'STORE_DEACTIVATED',
          entity: 'TIENDA',
          entityId: storeId,
        },
      });
      return { id: storeId, active: false };
    });
  }

  async createInvitation(
    input: {
      email: string;
      platformRole: 'PLATFORM_ADMIN' | 'USER';
      storeId?: string;
      storeRole?: 'STORE_ADMIN' | 'OPERATOR' | 'CLIENT';
      expiresAt: string;
    },
    actorId: string,
  ) {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invitation = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.userInvitation.create({
        data: {
          email: input.email,
          platformRole: input.platformRole,
          storeId: input.storeId ?? null,
          storeRole: input.storeRole ?? null,
          expiresAt: new Date(input.expiresAt),
          tokenHash,
          issuedById: actorId,
        },
      });
      await transaction.auditEvent.create({
        data: {
          userId: actorId,
          storeId: input.storeId ?? null,
          event: 'USER_INVITATION_CREATED',
          entity: 'INVITACION_USUARIO',
          entityId: created.id,
        },
      });
      return created;
    });
    return {
      id: invitation.id,
      email: invitation.email,
      token,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  async listAudit(storeId?: string) {
    const events = await this.prisma.auditEvent.findMany({
      where: storeId ? { storeId } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return events.map((event) => ({
      id: event.id,
      storeId: event.storeId,
      userId: event.userId,
      event: event.event,
      entity: event.entity,
      entityId: event.entityId,
      details: event.details,
      createdAt: event.createdAt.toISOString(),
    }));
  }

  async getMyAccounts(userId: string) {
    const accounts = await this.prisma.creditAccount.findMany({
      where: { customer: { userId }, active: true },
      include: { store: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return accounts.map((account) => ({
      id: account.id,
      storeId: account.storeId,
      storeName: account.store.name,
      accountNumber: account.accountNumber,
      currency: account.currency,
      creditLimit: account.creditLimit.toFixed(2),
      originalOutstanding: account.originalOutstanding.toFixed(2),
    }));
  }

  async getMyStatements(userId: string) {
    const cuts = await this.prisma.cut.findMany({
      where: { account: { customer: { userId } } },
      orderBy: { cutAt: 'desc' },
    });
    return cuts.map((cut) => ({
      id: cut.id,
      accountId: cut.accountId,
      cutAt: cut.cutAt.toISOString(),
      dueDate: cut.dueDate.toISOString().slice(0, 10),
      currency: cut.currency,
      totalDue: cut.totalDue.toFixed(2),
    }));
  }

  async getMyPurchases(userId: string) {
    const purchases = await this.prisma.purchase.findMany({
      where: { account: { customer: { userId } } },
      orderBy: { purchasedAt: 'desc' },
    });
    return purchases.map((purchase) => ({
      id: purchase.id,
      accountId: purchase.accountId,
      purchasedAt: purchase.purchasedAt.toISOString(),
      mode: purchase.mode,
      currency: purchase.currency,
      total: purchase.total.toFixed(2),
      status: purchase.status,
    }));
  }
}
