import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';

import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { toEffectiveDailyRate } from '../finance/domain/financial-engine.js';
import {
  type AccountSnapshot,
  type CreditConditionSnapshot,
  type CreditOperationsRepository,
  type CreditOperationsTransaction,
  type CutRecord,
  type ObligationRecord,
  type PaymentRecord,
  type ProductSnapshot,
  type PurchaseRecord,
  TransientTransactionError,
} from './ports/credit-operations.repository.js';

type TransactionClient = Prisma.TransactionClient;

function asDate(value: string): Date {
  return new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
}

function mapObligation(item: {
  id: string;
  creditId: string;
  installmentNumber: number;
  dueDate: Date;
  openingBalance: { toString(): string };
  principalDue: { toString(): string };
  compensatoryInterest: { toString(): string };
  lateDailyRate?: { toString(): string };
  lateInterest: { toString(): string };
  amountDue: { toString(): string };
  paidAmount: { toString(): string };
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'VOIDED';
}): ObligationRecord {
  return {
    id: item.id,
    creditId: item.creditId,
    installmentNumber: item.installmentNumber,
    dueDate: item.dueDate.toISOString().slice(0, 10),
    openingBalance: item.openingBalance.toString(),
    principalDue: item.principalDue.toString(),
    compensatoryInterest: item.compensatoryInterest.toString(),
    lateDailyRate: item.lateDailyRate?.toString() ?? '0',
    amountDue: item.amountDue.toString(),
    paidAmount: item.paidAmount.toString(),
    status: item.status === 'VOIDED' ? 'PENDING' : item.status,
  };
}

class PrismaCreditOperationsTransaction implements CreditOperationsTransaction {
  constructor(private readonly transaction: TransactionClient) {}

  async findPurchaseByIdempotency(
    storeId: string,
    idempotencyKey: string,
  ): Promise<PurchaseRecord | null> {
    const purchase = await this.transaction.purchase.findUnique({
      where: { storeId_idempotencyKey: { storeId, idempotencyKey } },
      include: {
        details: true,
        credit: { include: { obligations: true } },
      },
    });
    if (!purchase?.credit) return null;
    return {
      id: purchase.id,
      storeId: purchase.storeId,
      accountId: purchase.accountId,
      conditionId: purchase.conditionId,
      operatorUserId: purchase.operatorUserId,
      idempotencyKey: purchase.idempotencyKey,
      mode: purchase.mode,
      installmentCount: purchase.installmentCount,
      purchasedAt: purchase.purchasedAt.toISOString(),
      assignedCutAt: purchase.assignedCutAt.toISOString(),
      currency: purchase.currency,
      principal: purchase.credit.principal.toString(),
      total: purchase.total.toFixed(2),
      lines: purchase.details.map((line) => ({
        id: line.id,
        productId: line.productId,
        description: line.description,
        quantity: line.quantity.toString(),
        unitPrice: line.unitPrice.toString(),
        lineTotal: line.lineTotal.toString(),
      })),
      obligations: purchase.credit.obligations.map((obligation) =>
        mapObligation({
          ...obligation,
          lateDailyRate: purchase.credit!.lateDailyRate,
        }),
      ),
    };
  }

  async findCutByIdempotency(storeId: string, idempotencyKey: string) {
    const cut = await this.transaction.cut.findUnique({
      where: { storeId_idempotencyKey: { storeId, idempotencyKey } },
      include: { details: true },
    });
    return cut
      ? {
          id: cut.id,
          storeId: cut.storeId,
          accountId: cut.accountId,
          idempotencyKey: cut.idempotencyKey,
          cutAt: cut.cutAt.toISOString(),
          periodStart: cut.periodStart.toISOString().slice(0, 10),
          periodEnd: cut.periodEnd.toISOString().slice(0, 10),
          dueDate: cut.dueDate.toISOString().slice(0, 10),
          currency: cut.currency,
          totalDue: cut.totalDue.toFixed(2),
          obligationIds: cut.details.map((detail) => detail.obligationId),
        }
      : null;
  }

  async findPaymentByIdempotency(storeId: string, idempotencyKey: string) {
    const payment = await this.transaction.payment.findUnique({
      where: { storeId_idempotencyKey: { storeId, idempotencyKey } },
      include: { details: true },
    });
    return payment
      ? {
          id: payment.id,
          storeId: payment.storeId,
          accountId: payment.accountId,
          operatorUserId: payment.operatorUserId,
          idempotencyKey: payment.idempotencyKey,
          paidAt: payment.paidAt.toISOString(),
          currency: payment.currency,
          amount: payment.amount.toFixed(2),
          receiptNumber: payment.receiptNumber,
          allocations: payment.details.map((detail) => ({
            obligationId: detail.obligationId,
            lateInterestPaid: detail.lateInterestPaid.toFixed(2),
            compensatoryPaid: detail.compensatoryPaid.toFixed(2),
            principalPaid: detail.principalPaid.toFixed(2),
          })),
        }
      : null;
  }

  async getAccount(storeId: string, accountId: string): Promise<AccountSnapshot | null> {
    const account = await this.transaction.creditAccount.findUnique({
      where: { id_storeId: { id: accountId, storeId } },
    });
    return account
      ? {
          id: account.id,
          storeId: account.storeId,
          currency: account.currency,
          creditLimit: account.creditLimit.toString(),
          originalOutstanding: account.originalOutstanding.toString(),
          active: account.active,
        }
      : null;
  }

  async getActiveCondition(
    accountId: string,
    at: string,
  ): Promise<CreditConditionSnapshot | null> {
    const condition = await this.transaction.creditCondition.findFirst({
      where: {
        accountId,
        validFrom: { lte: asDate(at) },
        OR: [{ validUntil: null }, { validUntil: { gt: asDate(at) } }],
      },
      orderBy: { version: 'desc' },
    });
    return condition
      ? {
          id: condition.id,
          accountId: condition.accountId,
          compensatoryRateKind: condition.compensatoryRateKind,
          compensatoryRate: condition.compensatoryRate.toString(),
          lateRateKind: condition.lateRateKind,
          lateRate: condition.lateRate.toString(),
          billingDay: condition.billingDay,
          dueDay: condition.dueDay,
          maxInstallments: condition.maxInstallments,
          graceMonths: condition.graceMonths,
        }
      : null;
  }

  async getProducts(storeId: string, productIds: string[]): Promise<ProductSnapshot[]> {
    const products = await this.transaction.productService.findMany({
      where: { storeId, id: { in: productIds } },
    });
    return products.map((product) => ({
      id: product.id,
      storeId: product.storeId,
      name: product.name,
      unitPrice: product.unitPrice.toString(),
      currency: product.currency,
      active: product.active,
    }));
  }

  async listObligationsForCut(accountId: string, cutAt: string) {
    const obligations = await this.transaction.obligation.findMany({
      where: {
        credit: {
          accountId,
          purchase: { assignedCutAt: { lte: asDate(cutAt) } },
        },
        cutDetails: { none: {} },
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      include: { credit: { select: { lateDailyRate: true } } },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
    });
    return obligations.map((obligation) =>
      mapObligation({
        ...obligation,
        lateDailyRate: obligation.credit.lateDailyRate,
      }),
    );
  }

  async listPayableObligations(accountId: string, paidOn: string) {
    const obligations = await this.transaction.obligation.findMany({
      where: {
        credit: { accountId },
        dueDate: { lte: asDate(paidOn) },
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      include: { credit: { select: { lateDailyRate: true } } },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
    });
    return obligations.map((obligation) =>
      mapObligation({
        ...obligation,
        lateDailyRate: obligation.credit.lateDailyRate,
      }),
    );
  }

  async savePurchase(purchase: PurchaseRecord): Promise<void> {
    const condition = await this.transaction.creditCondition.findUniqueOrThrow({
      where: { id: purchase.conditionId },
    });
    const dailyRate = toEffectiveDailyRate({
      rate: condition.compensatoryRate.toString(),
      kind:
        condition.compensatoryRateKind === 'EFFECTIVE_ANNUAL'
          ? 'EFFECTIVE'
          : 'NOMINAL',
      baseDays: 360,
      ...(condition.compensatoryRateKind === 'NOMINAL_ANNUAL'
        ? { capitalizationDays: 1 }
        : {}),
    });
    const first = purchase.obligations[0]!;
    await this.transaction.purchase.create({
      data: {
        id: purchase.id,
        storeId: purchase.storeId,
        accountId: purchase.accountId,
        conditionId: purchase.conditionId,
        operatorUserId: purchase.operatorUserId,
        idempotencyKey: purchase.idempotencyKey,
        mode: purchase.mode,
        installmentCount: purchase.installmentCount,
        purchasedAt: asDate(purchase.purchasedAt),
        assignedCutAt: asDate(purchase.assignedCutAt),
        currency: purchase.currency,
        subtotal: purchase.total,
        total: purchase.total,
        details: {
          create: purchase.lines.map((line) => ({
            id: line.id,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
            product: {
              connect: {
                id_storeId: {
                  id: line.productId,
                  storeId: purchase.storeId,
                },
              },
            },
          })),
        },
        credit: {
          create: {
            id: first.creditId,
            principal: purchase.principal,
            currency: purchase.currency,
            baseDate: asDate(purchase.purchasedAt.slice(0, 10)),
            installmentCount: purchase.obligations.length,
            graceMonths: condition.graceMonths,
            effectiveDailyRate: dailyRate.toFixed(15),
            lateDailyRate: first.lateDailyRate,
            account: {
              connect: {
                id_storeId: {
                  id: purchase.accountId,
                  storeId: purchase.storeId,
                },
              },
            },
            obligations: {
              create: purchase.obligations.map((obligation) => ({
                id: obligation.id,
                installmentNumber: obligation.installmentNumber,
                dueDate: asDate(obligation.dueDate),
                openingBalance: obligation.openingBalance,
                principalDue: obligation.principalDue,
                compensatoryInterest: obligation.compensatoryInterest,
                lateInterest: '0',
                amountDue: obligation.amountDue,
                paidAmount: obligation.paidAmount,
                status: obligation.status,
              })),
            },
          },
        },
      },
    });
    await this.transaction.creditAccount.update({
      where: { id_storeId: { id: purchase.accountId, storeId: purchase.storeId } },
      data: { originalOutstanding: { increment: purchase.principal } },
    });
  }

  async saveCut(cut: CutRecord): Promise<void> {
    const obligations = await this.transaction.obligation.findMany({
      where: { id: { in: cut.obligationIds } },
      select: { id: true, amountDue: true },
    });
    await this.transaction.cut.create({
      data: {
        id: cut.id,
        storeId: cut.storeId,
        accountId: cut.accountId,
        idempotencyKey: cut.idempotencyKey,
        cutAt: asDate(cut.cutAt),
        periodStart: asDate(cut.periodStart),
        periodEnd: asDate(cut.periodEnd),
        dueDate: asDate(cut.dueDate),
        currency: cut.currency,
        totalDue: cut.totalDue,
        details: {
          create: obligations.map((obligation) => ({
            amountDue: obligation.amountDue,
            obligation: { connect: { id: obligation.id } },
          })),
        },
      },
    });
  }

  async savePayment(payment: PaymentRecord): Promise<void> {
    await this.transaction.payment.create({
      data: {
        id: payment.id,
        storeId: payment.storeId,
        accountId: payment.accountId,
        operatorUserId: payment.operatorUserId,
        idempotencyKey: payment.idempotencyKey,
        paidAt: asDate(payment.paidAt),
        currency: payment.currency,
        amount: payment.amount,
        method: 'OTHER',
        receiptNumber: payment.receiptNumber,
        details: {
          create: payment.allocations.map((allocation) => ({
            lateInterestPaid: allocation.lateInterestPaid,
            compensatoryPaid: allocation.compensatoryPaid,
            principalPaid: allocation.principalPaid,
            obligation: { connect: { id: allocation.obligationId } },
          })),
        },
      },
    });
    for (const allocation of payment.allocations) {
      const paidAmount = new Decimal(allocation.lateInterestPaid)
        .plus(allocation.compensatoryPaid)
        .plus(allocation.principalPaid)
        .toString();
      await this.transaction.obligation.update({
        where: { id: allocation.obligationId },
        data: { status: 'PAID', paidAmount: { increment: paidAmount } },
      });
    }
    const account = await this.transaction.creditAccount.findUniqueOrThrow({
      where: { id_storeId: { id: payment.accountId, storeId: payment.storeId } },
    });
    const principalPaid = payment.allocations.reduce(
      (sum, allocation) => sum.plus(allocation.principalPaid),
      new Decimal(0),
    );
    await this.transaction.creditAccount.update({
      where: { id_storeId: { id: payment.accountId, storeId: payment.storeId } },
      data: {
        originalOutstanding: Decimal.max(
          0,
          new Decimal(account.originalOutstanding.toString()).minus(principalPaid),
        ).toString(),
      },
    });
  }
}

@Injectable()
export class PrismaCreditOperationsRepository
  implements CreditOperationsRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async withLockedAccount<T>(
    accountId: string,
    operation: (transaction: CreditOperationsTransaction) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          await transaction.$queryRaw`SELECT id FROM CUENTA_CREDITO WHERE id = ${accountId} FOR UPDATE`;
          return operation(new PrismaCreditOperationsTransaction(transaction));
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      const candidate = error as { code?: string; message?: string };
      if (
        candidate.code === 'P2034' ||
        /deadlock|serialization|lock wait timeout/i.test(candidate.message ?? '')
      ) {
        throw new TransientTransactionError(candidate.message);
      }
      throw error;
    }
  }
}
