import { createHash, randomBytes } from 'node:crypto';

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';

import { PrismaService } from '../../database/prisma.service.js';
import { summarizeInitialCapitalization } from '../finance/domain/financial-engine.js';
import { effectiveObligationStatus } from '../finance/domain/obligation-status.js';

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
    if (input.storeId) {
      const activeStore = await this.prisma.store.findFirst({
        where: { id: input.storeId, active: true },
        select: { id: true },
      });
      if (!activeStore) throw new NotFoundException('La tienda no está activa.');
    }
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

  async listUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { displayName: 'asc' },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        platformRole: true,
        active: true,
        createdAt: true,
        passwordHash: false,
        accesses: {
          orderBy: { createdAt: 'asc' },
          select: {
            storeId: true,
            role: true,
            active: true,
            store: { select: { name: true } },
          },
        },
      },
    });
    return users.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      platformRole: user.platformRole,
      active: user.active,
      createdAt: user.createdAt.toISOString(),
      storeAccesses: user.accesses.map((access) => ({
        storeId: access.storeId,
        storeName: access.store.name,
        role: access.role,
        active: access.active,
      })),
    }));
  }

  async listInvitations(now = new Date()) {
    const invitations = await this.prisma.userInvitation.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        platformRole: true,
        storeRole: true,
        status: true,
        expiresAt: true,
        acceptedAt: true,
        createdAt: true,
        tokenHash: false,
        store: { select: { id: true, name: true } },
        issuedBy: { select: { id: true, displayName: true } },
      },
    });
    return invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      platformRole: invitation.platformRole,
      storeRole: invitation.storeRole,
      status: invitation.status === 'PENDING' && invitation.expiresAt <= now
        ? 'EXPIRED' as const
        : invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
      createdAt: invitation.createdAt.toISOString(),
      store: invitation.store,
      issuedBy: invitation.issuedBy,
    }));
  }

  revokeInvitation(invitationId: string, actorId: string, now = new Date()) {
    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.userInvitation.updateMany({
        where: { id: invitationId, status: 'PENDING', expiresAt: { gt: now } },
        data: { status: 'REVOKED' },
      });
      if (result.count === 0) {
        throw new BadRequestException('La invitación ya no puede revocarse.');
      }
      const invitation = await transaction.userInvitation.findUniqueOrThrow({
        where: { id: invitationId },
        select: { storeId: true },
      });
      await transaction.auditEvent.create({
        data: {
          userId: actorId,
          storeId: invitation.storeId,
          event: 'USER_INVITATION_REVOKED',
          entity: 'INVITACION_USUARIO',
          entityId: invitationId,
        },
      });
      return { id: invitationId, status: 'REVOKED' as const };
    });
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
      include: {
        details: {
          include: { product: { select: { imageUrl: true } } },
          orderBy: { id: 'asc' },
        },
      },
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
      items: purchase.details.map((detail) => ({
        productId: detail.productId,
        description: detail.description,
        quantity: detail.quantity.toFixed(4),
        unitPrice: detail.unitPrice.toFixed(4),
        lineTotal: detail.lineTotal.toFixed(2),
        imageUrl: detail.product.imageUrl,
      })),
    }));
  }

  async getMySchedule(userId: string, now = new Date()) {
    const obligations = await this.prisma.obligation.findMany({
      where: { credit: { account: { customer: { userId } } } },
      include: {
        credit: {
          select: {
            accountId: true,
            purchaseId: true,
            principal: true,
            currency: true,
            purchase: { select: { mode: true, purchasedAt: true } },
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { installmentNumber: 'asc' }],
    });
    const firstByPurchase = new Map<string, (typeof obligations)[number]>();
    for (const obligation of obligations) {
      const current = firstByPurchase.get(obligation.credit.purchaseId);
      if (!current || obligation.installmentNumber < current.installmentNumber) {
        firstByPurchase.set(obligation.credit.purchaseId, obligation);
      }
    }
    return obligations.map((obligation) => ({
      id: obligation.id,
      accountId: obligation.credit.accountId,
      purchaseId: obligation.credit.purchaseId,
      purchasedAt: obligation.credit.purchase.purchasedAt.toISOString(),
      installmentNumber: obligation.installmentNumber,
      dueDate: obligation.dueDate.toISOString().slice(0, 10),
      currency: obligation.credit.currency,
      openingBalance: obligation.openingBalance.toFixed(2),
      principalDue: obligation.principalDue.toFixed(2),
      compensatoryInterest: obligation.compensatoryInterest.toFixed(2),
      lateInterest: obligation.lateInterest.toFixed(2),
      amountDue: obligation.amountDue.toFixed(2),
      paidAmount: obligation.paidAmount.toFixed(2),
      status: effectiveObligationStatus(obligation.status, obligation.dueDate, now),
      capitalization: obligation.credit.purchase.mode === 'INSTALLMENTS'
        ? summarizeInitialCapitalization({
            purchaseDate: DateTime.fromJSDate(
              obligation.credit.purchase.purchasedAt,
              { zone: 'utc' },
            ).setZone('America/Lima').toISODate()!,
            firstDueDate: firstByPurchase.get(obligation.credit.purchaseId)!.dueDate
              .toISOString()
              .slice(0, 10),
            originalPrincipal: obligation.credit.principal.toString(),
            capitalizedPrincipal: firstByPurchase
              .get(obligation.credit.purchaseId)!
              .openingBalance.toString(),
          })
        : null,
    }));
  }

  async getMyPayments(userId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { account: { customer: { userId } } },
      include: { details: { orderBy: { id: 'asc' } } },
      orderBy: { paidAt: 'desc' },
    });
    return payments.map((payment) => ({
      id: payment.id,
      accountId: payment.accountId,
      paidAt: payment.paidAt.toISOString(),
      currency: payment.currency,
      amount: payment.amount.toFixed(2),
      method: payment.method,
      receiptNumber: payment.receiptNumber,
      allocations: payment.details.map((detail) => ({
        obligationId: detail.obligationId,
        lateInterestPaid: detail.lateInterestPaid.toFixed(2),
        compensatoryPaid: detail.compensatoryPaid.toFixed(2),
        principalPaid: detail.principalPaid.toFixed(2),
      })),
    }));
  }
}
