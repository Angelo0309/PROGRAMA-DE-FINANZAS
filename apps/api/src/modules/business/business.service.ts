import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class BusinessService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listClients(storeId: string) {
    return this.prisma.customer.findMany({
      where: { storeId, active: true },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        documentType: true,
        documentNumber: true,
        fullName: true,
        phone: true,
        address: true,
      },
    });
  }

  async createClient(
    storeId: string,
    input: {
      documentType: string;
      documentNumber: string;
      fullName: string;
      phone?: string;
      address?: string;
      userId?: string;
    },
    actorId: string,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const client = await transaction.customer.create({
        data: { storeId, ...input },
        select: {
          id: true,
          documentType: true,
          documentNumber: true,
          fullName: true,
          phone: true,
          address: true,
        },
      });
      await transaction.auditEvent.create({
        data: {
          storeId,
          userId: actorId,
          event: 'CLIENT_CREATED',
          entity: 'CLIENTE',
          entityId: client.id,
        },
      });
      return client;
    });
  }

  deactivateClient(storeId: string, clientId: string, actorId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.customer.updateMany({
        where: { id: clientId, storeId, active: true },
        data: { active: false },
      });
      if (result.count === 0) throw new NotFoundException('Cliente no encontrado.');
      await transaction.creditAccount.updateMany({
        where: { customerId: clientId, storeId, active: true },
        data: { active: false },
      });
      await transaction.auditEvent.create({
        data: {
          storeId,
          userId: actorId,
          event: 'CLIENT_DEACTIVATED',
          entity: 'CLIENTE',
          entityId: clientId,
        },
      });
      return { id: clientId, active: false };
    });
  }

  async listProducts(storeId: string) {
    const products = await this.prisma.productService.findMany({
      where: { storeId, active: true },
      orderBy: { name: 'asc' },
    });
    return products.map((product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      unitPrice: product.unitPrice.toFixed(4),
      currency: product.currency,
      imageUrl: product.imageUrl,
    }));
  }

  async createProduct(
    storeId: string,
    input: {
      sku: string;
      name: string;
      description?: string;
      unitPrice: string;
      currency: string;
      imageUrl?: string;
    },
    actorId: string,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const product = await transaction.productService.create({
        data: { storeId, ...input },
      });
      await transaction.auditEvent.create({
        data: {
          storeId,
          userId: actorId,
          event: 'PRODUCT_CREATED',
          entity: 'PRODUCTO_SERVICIO',
          entityId: product.id,
        },
      });
      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        unitPrice: product.unitPrice.toFixed(4),
        currency: product.currency,
        imageUrl: product.imageUrl,
      };
    });
  }

  deactivateProduct(storeId: string, productId: string, actorId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.productService.updateMany({
        where: { id: productId, storeId, active: true },
        data: { active: false },
      });
      if (result.count === 0) throw new NotFoundException('Producto o servicio no encontrado.');
      await transaction.auditEvent.create({
        data: {
          storeId,
          userId: actorId,
          event: 'PRODUCT_DEACTIVATED',
          entity: 'PRODUCTO_SERVICIO',
          entityId: productId,
        },
      });
      return { id: productId, active: false };
    });
  }

  async listAccounts(storeId: string) {
    const accounts = await this.prisma.creditAccount.findMany({
      where: { storeId, active: true },
      include: {
        customer: { select: { fullName: true } },
        conditions: { orderBy: { version: 'desc' }, take: 1 },
      },
      orderBy: { accountNumber: 'asc' },
    });
    return accounts.map((account) => {
      const currentCondition = account.conditions[0];
      return {
        id: account.id,
        accountNumber: account.accountNumber,
        customerId: account.customerId,
        customerName: account.customer.fullName,
        currency: account.currency,
        creditLimit: account.creditLimit.toFixed(2),
        originalOutstanding: account.originalOutstanding.toFixed(2),
        ...(currentCondition ? {
          currentCondition: {
            id: currentCondition.id,
            version: currentCondition.version,
            compensatoryRateKind: currentCondition.compensatoryRateKind,
            compensatoryRate: currentCondition.compensatoryRate.toFixed(12),
            lateRateKind: currentCondition.lateRateKind,
            lateRate: currentCondition.lateRate.toFixed(12),
            billingDay: currentCondition.billingDay,
            dueDay: currentCondition.dueDay,
            maxInstallments: currentCondition.maxInstallments,
            graceMonths: currentCondition.graceMonths,
            validFrom: currentCondition.validFrom.toISOString(),
            validUntil: currentCondition.validUntil?.toISOString() ?? null,
          },
        } : {}),
      };
    });
  }

  async createAccount(
    storeId: string,
    input: {
      customerId: string;
      accountNumber: string;
      currency: string;
      creditLimit: string;
      initialCondition?: {
        compensatoryRateKind: 'EFFECTIVE_ANNUAL' | 'NOMINAL_ANNUAL';
        compensatoryRate: string;
        lateRateKind: 'EFFECTIVE_ANNUAL' | 'NOMINAL_ANNUAL';
        lateRate: string;
        billingDay: number;
        dueDay: number;
        maxInstallments: number;
        graceMonths: number;
        validFrom: string;
      };
    },
    actorId: string,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const customer = await transaction.customer.findUnique({
        where: { id_storeId: { id: input.customerId, storeId } },
      });
      if (!customer?.active) throw new NotFoundException('Cliente no encontrado.');
      const { initialCondition, ...accountInput } = input;
      const account = await transaction.creditAccount.create({
        data: { storeId, ...accountInput },
      });
      const condition = initialCondition
        ? await transaction.creditCondition.create({
          data: {
            storeId,
            accountId: account.id,
            ...initialCondition,
            validFrom: new Date(initialCondition.validFrom),
            version: 1,
          },
        })
        : null;
      await transaction.auditEvent.create({
        data: {
          storeId,
          userId: actorId,
          event: 'CREDIT_ACCOUNT_CREATED',
          entity: 'CUENTA_CREDITO',
          entityId: account.id,
        },
      });
      if (condition) {
        await transaction.auditEvent.create({
          data: {
            storeId,
            userId: actorId,
            event: 'CREDIT_CONDITION_VERSIONED',
            entity: 'CONDICION_CREDITICIA',
            entityId: condition.id,
          },
        });
      }
      return {
        id: account.id,
        accountNumber: account.accountNumber,
        customerId: account.customerId,
        currency: account.currency,
        creditLimit: account.creditLimit.toFixed(2),
        originalOutstanding: account.originalOutstanding.toFixed(2),
        ...(condition ? {
          currentCondition: {
            ...condition,
            compensatoryRate: condition.compensatoryRate.toFixed(12),
            lateRate: condition.lateRate.toFixed(12),
            validFrom: condition.validFrom.toISOString(),
            validUntil: condition.validUntil?.toISOString() ?? null,
          },
        } : {}),
      };
    });
  }

  deactivateAccount(storeId: string, accountId: string, actorId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.creditAccount.updateMany({
        where: { id: accountId, storeId, active: true },
        data: { active: false },
      });
      if (result.count === 0) throw new NotFoundException('Cuenta no encontrada.');
      await transaction.auditEvent.create({
        data: {
          storeId,
          userId: actorId,
          event: 'CREDIT_ACCOUNT_DEACTIVATED',
          entity: 'CUENTA_CREDITO',
          entityId: accountId,
        },
      });
      return { id: accountId, active: false };
    });
  }

  async addCreditCondition(
    storeId: string,
    accountId: string,
    input: {
      compensatoryRateKind: 'EFFECTIVE_ANNUAL' | 'NOMINAL_ANNUAL';
      compensatoryRate: string;
      lateRateKind: 'EFFECTIVE_ANNUAL' | 'NOMINAL_ANNUAL';
      lateRate: string;
      billingDay: number;
      dueDay: number;
      maxInstallments: number;
      graceMonths: number;
      validFrom: string;
    },
    actorId: string,
  ) {
    return this.prisma.$transaction(
      async (transaction) => {
        const account = await transaction.creditAccount.findUnique({
          where: { id_storeId: { id: accountId, storeId } },
        });
        if (!account?.active) throw new NotFoundException('Cuenta no encontrada.');
        const previous = await transaction.creditCondition.findFirst({
          where: { accountId },
          orderBy: { version: 'desc' },
        });
        const validFrom = new Date(input.validFrom);
        if (previous && previous.validUntil === null) {
          await transaction.creditCondition.update({
            where: { id: previous.id },
            data: { validUntil: validFrom },
          });
        }
        const condition = await transaction.creditCondition.create({
          data: {
            storeId,
            accountId,
            ...input,
            validFrom,
            version: (previous?.version ?? 0) + 1,
          },
        });
        await transaction.auditEvent.create({
          data: {
            storeId,
            userId: actorId,
            event: 'CREDIT_CONDITION_VERSIONED',
            entity: 'CONDICION_CREDITICIA',
            entityId: condition.id,
          },
        });
        return {
          ...condition,
          compensatoryRate: condition.compensatoryRate.toFixed(12),
          lateRate: condition.lateRate.toFixed(12),
          validFrom: condition.validFrom.toISOString(),
          validUntil: condition.validUntil?.toISOString() ?? null,
        };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async getSchedule(storeId: string, accountId: string) {
    const obligations = await this.prisma.obligation.findMany({
      where: { credit: { storeId, accountId } },
      include: { credit: { select: { purchaseId: true, currency: true } } },
      orderBy: [{ dueDate: 'asc' }, { installmentNumber: 'asc' }],
    });
    return obligations.map((item) => ({
      id: item.id,
      purchaseId: item.credit.purchaseId,
      installmentNumber: item.installmentNumber,
      dueDate: item.dueDate.toISOString().slice(0, 10),
      openingBalance: item.openingBalance.toFixed(2),
      principalDue: item.principalDue.toFixed(2),
      compensatoryInterest: item.compensatoryInterest.toFixed(2),
      lateInterest: item.lateInterest.toFixed(2),
      amountDue: item.amountDue.toFixed(2),
      paidAmount: item.paidAmount.toFixed(2),
      currency: item.credit.currency,
      status: item.status,
    }));
  }

  async getStatements(storeId: string, accountId: string) {
    const cuts = await this.prisma.cut.findMany({
      where: { storeId, accountId },
      orderBy: { cutAt: 'desc' },
    });
    return cuts.map((cut) => ({
      id: cut.id,
      cutAt: cut.cutAt.toISOString(),
      periodStart: cut.periodStart.toISOString().slice(0, 10),
      periodEnd: cut.periodEnd.toISOString().slice(0, 10),
      dueDate: cut.dueDate.toISOString().slice(0, 10),
      currency: cut.currency,
      totalDue: cut.totalDue.toFixed(2),
    }));
  }

  async getReceipt(storeId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, storeId },
      include: { details: true },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado.');
    return {
      id: payment.id,
      receiptNumber: payment.receiptNumber,
      paidAt: payment.paidAt.toISOString(),
      currency: payment.currency,
      amount: payment.amount.toFixed(2),
      allocations: payment.details.map((detail) => ({
        obligationId: detail.obligationId,
        lateInterestPaid: detail.lateInterestPaid.toFixed(2),
        compensatoryPaid: detail.compensatoryPaid.toFixed(2),
        principalPaid: detail.principalPaid.toFixed(2),
      })),
    };
  }
}
