import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { DateTime } from 'luxon';

import {
  assignBillingCycle,
  buildFrenchSchedule,
  calculateAmountDue,
  calculateEndOfMonthObligation,
  toEffectiveDailyRate,
} from '../finance/domain/financial-engine.js';
import {
  type CreditConditionSnapshot,
  type CreditOperationsRepository,
  type CreditOperationsTransaction,
  type CutRecord,
  type ObligationRecord,
  type PaymentRecord,
  type PurchaseRecord,
  TransientTransactionError,
} from './ports/credit-operations.repository.js';

type IdGenerator = () => string;

export interface CreatePurchaseInput {
  storeId: string;
  accountId: string;
  operatorUserId: string;
  idempotencyKey: string;
  purchasedAt: string;
  currency: string;
  mode: 'END_OF_MONTH' | 'INSTALLMENTS';
  installmentCount?: number;
  items: Array<{ productId: string; quantity: string }>;
}

export interface CreateCutInput {
  storeId: string;
  accountId: string;
  operatorUserId?: string;
  idempotencyKey: string;
  cutAt: string;
}

export interface CreatePaymentInput {
  storeId: string;
  accountId: string;
  operatorUserId: string;
  idempotencyKey: string;
  paidAt: string;
  currency: string;
  amount: string;
}

const money = (value: Decimal.Value) =>
  new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
const precise = (value: Decimal.Value) => new Decimal(value).toFixed(12);

@Injectable()
export class CreditOperationsService {
  constructor(
    private readonly repository: CreditOperationsRepository,
    private readonly generateId: IdGenerator,
  ) {}

  createPurchase(input: CreatePurchaseInput): Promise<PurchaseRecord> {
    return this.withRetry(input.accountId, async (transaction) => {
      const repeated = await transaction.findPurchaseByIdempotency(
        input.storeId,
        input.idempotencyKey,
      );
      if (repeated) return repeated;

      const account = await transaction.getAccount(input.storeId, input.accountId);
      if (!account?.active) throw new NotFoundException('Cuenta de crédito no encontrada.');
      if (account.currency !== input.currency) {
        throw new BadRequestException('La moneda no coincide con la cuenta.');
      }

      const condition = await transaction.getActiveCondition(
        input.accountId,
        input.purchasedAt,
      );
      if (!condition) throw new ConflictException('La cuenta no tiene condiciones vigentes.');
      this.validateInstallments(input, condition);

      if (input.items.length === 0) {
        throw new BadRequestException('La compra debe contener productos o servicios.');
      }
      const productIds = [...new Set(input.items.map((item) => item.productId))];
      const products = await transaction.getProducts(input.storeId, productIds);
      if (products.length !== productIds.length || products.some((item) => !item.active)) {
        throw new BadRequestException('Uno o más productos no están disponibles.');
      }

      const productById = new Map(products.map((product) => [product.id, product]));
      const principal = input.items.reduce((sum, item) => {
        const quantity = new Decimal(item.quantity);
        const product = productById.get(item.productId)!;
        if (!quantity.isPositive()) throw new BadRequestException('La cantidad debe ser positiva.');
        if (product.currency !== input.currency) {
          throw new BadRequestException('No se pueden mezclar monedas en una compra.');
        }
        return sum.plus(new Decimal(product.unitPrice).mul(quantity));
      }, new Decimal(0));

      if (new Decimal(account.originalOutstanding).plus(principal).gt(account.creditLimit)) {
        throw new ConflictException('La compra excede el límite de crédito disponible.');
      }

      const purchaseDateTime = DateTime.fromISO(input.purchasedAt, {
        setZone: true,
      }).setZone('America/Lima');
      if (!purchaseDateTime.isValid) throw new BadRequestException('Fecha de compra inválida.');
      const purchaseDate = purchaseDateTime.toISODate()!;
      const cycle = assignBillingCycle({
        purchasedAt: input.purchasedAt,
        cutDay: condition.billingDay,
        cutTime: '23:59:59',
        paymentDay: condition.dueDay,
        zone: 'America/Lima',
      });
      const dailyRate = this.toDailyRate(
        condition.compensatoryRate,
        condition.compensatoryRateKind,
      );
      const lateDailyRate = this.toDailyRate(
        condition.lateRate,
        condition.lateRateKind,
      );
      const creditId = this.generateId();
      const obligations =
        input.mode === 'END_OF_MONTH'
          ? this.buildEndOfMonthObligation(
              creditId,
              principal,
              purchaseDate,
              cycle.basePaymentDate,
              dailyRate,
              lateDailyRate,
            )
          : this.buildInstallments(
              creditId,
              principal,
              purchaseDate,
              cycle.basePaymentDate,
              condition,
              input.installmentCount!,
              dailyRate,
              lateDailyRate,
            );

      const purchase: PurchaseRecord = {
        id: this.generateId(),
        storeId: input.storeId,
        accountId: input.accountId,
        conditionId: condition.id,
        operatorUserId: input.operatorUserId,
        idempotencyKey: input.idempotencyKey,
        mode: input.mode,
        installmentCount: input.mode === 'INSTALLMENTS' ? input.installmentCount! : null,
        purchasedAt: input.purchasedAt,
        assignedCutAt: cycle.assignedCutAt,
        currency: input.currency,
        principal: precise(principal),
        total: money(principal),
        lines: input.items.map((item) => {
          const product = productById.get(item.productId)!;
          return {
            id: this.generateId(),
            productId: product.id,
            description: product.name,
            quantity: new Decimal(item.quantity).toFixed(4),
            unitPrice: new Decimal(product.unitPrice).toFixed(4),
            lineTotal: new Decimal(product.unitPrice)
              .mul(item.quantity)
              .toFixed(4),
          };
        }),
        obligations,
      };
      await transaction.savePurchase(purchase);
      await transaction.recordAudit({
        storeId: input.storeId,
        userId: input.operatorUserId,
        event: 'PURCHASE_CREATED',
        entity: 'COMPRA',
        entityId: purchase.id,
      });
      return purchase;
    });
  }

  createCut(input: CreateCutInput): Promise<CutRecord> {
    return this.withRetry(input.accountId, async (transaction) => {
      const repeated = await transaction.findCutByIdempotency(input.storeId, input.idempotencyKey);
      if (repeated) return repeated;
      const account = await transaction.getAccount(input.storeId, input.accountId);
      if (!account) throw new NotFoundException('Cuenta de crédito no encontrada.');
      const cutAt = DateTime.fromISO(input.cutAt, { setZone: true }).setZone('America/Lima');
      if (!cutAt.isValid) throw new BadRequestException('Instante de corte inválido.');
      const obligations = await transaction.listObligationsForCut(input.accountId, input.cutAt);
      const total = obligations.reduce(
        (sum, obligation) => sum.plus(obligation.amountDue),
        new Decimal(0),
      );
      const periodEnd = cutAt.toISODate()!;
      const cut: CutRecord = {
        id: this.generateId(),
        storeId: input.storeId,
        accountId: input.accountId,
        idempotencyKey: input.idempotencyKey,
        cutAt: input.cutAt,
        periodStart: cutAt.minus({ months: 1 }).plus({ days: 1 }).toISODate()!,
        periodEnd,
        dueDate: obligations.map((item) => item.dueDate).sort()[0] ?? periodEnd,
        currency: account.currency,
        totalDue: money(total),
        obligationIds: obligations.map((item) => item.id),
      };
      await transaction.saveCut(cut);
      await transaction.recordAudit({
        storeId: input.storeId,
        userId: input.operatorUserId ?? null,
        event: 'CUT_CREATED',
        entity: 'CORTE',
        entityId: cut.id,
      });
      return cut;
    });
  }

  createPayment(input: CreatePaymentInput): Promise<PaymentRecord> {
    return this.withRetry(input.accountId, async (transaction) => {
      const repeated = await transaction.findPaymentByIdempotency(
        input.storeId,
        input.idempotencyKey,
      );
      if (repeated) return repeated;
      const account = await transaction.getAccount(input.storeId, input.accountId);
      if (!account) throw new NotFoundException('Cuenta de crédito no encontrada.');
      if (account.currency !== input.currency) {
        throw new BadRequestException('La moneda no coincide con la cuenta.');
      }
      const paidAt = DateTime.fromISO(input.paidAt, { setZone: true }).setZone('America/Lima');
      if (!paidAt.isValid) throw new BadRequestException('Fecha de pago inválida.');
      const paidOn = paidAt.toISODate()!;
      const obligations = await transaction.listPayableObligations(input.accountId, paidOn);
      if (obligations.length === 0) {
        throw new BadRequestException('No existen obligaciones exigibles para pagar.');
      }
      const due = calculateAmountDue({
        paidAt: paidOn,
        obligations: obligations.map((obligation) => ({
          id: obligation.id,
          dueDate: obligation.dueDate,
          baseAmount: obligation.amountDue,
          compensatoryInterest: obligation.compensatoryInterest,
          originalPrincipal: obligation.principalDue,
          lateDailyRate: new Decimal(obligation.lateDailyRate),
        })),
      });
      if (!new Decimal(input.amount).eq(due.moneyTotal)) {
        throw new BadRequestException(`El pago debe ser completo por ${due.moneyTotal} ${input.currency}.`);
      }
      const adjustment = new Decimal(due.roundingAdjustment);
      const allocations = due.lines.map((line, index) => ({
        obligationId: line.id,
        lateInterestPaid: money(line.lateInterest),
        compensatoryPaid: money(line.compensatoryInterest),
        principalPaid: money(
          index === due.lines.length - 1
            ? line.originalPrincipal.plus(adjustment)
            : line.originalPrincipal,
        ),
      }));
      const paymentId = this.generateId();
      const payment: PaymentRecord = {
        id: paymentId,
        storeId: input.storeId,
        accountId: input.accountId,
        operatorUserId: input.operatorUserId,
        idempotencyKey: input.idempotencyKey,
        paidAt: input.paidAt,
        currency: input.currency,
        amount: due.moneyTotal,
        receiptNumber: `RC-${paymentId}`,
        allocations,
      };
      await transaction.savePayment(payment);
      await transaction.recordAudit({
        storeId: input.storeId,
        userId: input.operatorUserId,
        event: 'PAYMENT_CREATED',
        entity: 'PAGO',
        entityId: payment.id,
      });
      return payment;
    });
  }

  private validateInstallments(
    input: CreatePurchaseInput,
    condition: CreditConditionSnapshot,
  ): void {
    if (
      input.mode === 'INSTALLMENTS' &&
      (!Number.isInteger(input.installmentCount) ||
        input.installmentCount! < 1 ||
        input.installmentCount! > condition.maxInstallments)
    ) {
      throw new BadRequestException(
        `El número de cuotas debe estar entre 1 y ${condition.maxInstallments}.`,
      );
    }
  }

  private toDailyRate(
    rate: string,
    kind: 'EFFECTIVE_ANNUAL' | 'NOMINAL_ANNUAL',
  ): Decimal {
    return toEffectiveDailyRate({
      rate,
      kind: kind === 'EFFECTIVE_ANNUAL' ? 'EFFECTIVE' : 'NOMINAL',
      baseDays: 360,
      ...(kind === 'NOMINAL_ANNUAL' ? { capitalizationDays: 1 } : {}),
    });
  }

  private buildEndOfMonthObligation(
    creditId: string,
    principal: Decimal,
    purchaseDate: string,
    dueDate: string,
    dailyRate: Decimal,
    lateDailyRate: Decimal,
  ): ObligationRecord[] {
    const result = calculateEndOfMonthObligation({
      principal,
      purchaseDate,
      paymentDate: dueDate,
      dailyRate,
    });
    return [
      {
        id: this.generateId(),
        creditId,
        installmentNumber: 1,
        dueDate,
        openingBalance: precise(principal),
        principalDue: precise(principal),
        originalPrincipalRecoverable: precise(principal),
        compensatoryInterest: precise(result.interest),
        lateDailyRate: lateDailyRate.toFixed(15),
        amountDue: precise(result.amount),
        paidAmount: '0.000000000000',
        status: 'PENDING',
      },
    ];
  }

  private buildInstallments(
    creditId: string,
    principal: Decimal,
    purchaseDate: string,
    basePaymentDate: string,
    condition: CreditConditionSnapshot,
    installmentCount: number,
    dailyRate: Decimal,
    lateDailyRate: Decimal,
  ): ObligationRecord[] {
    const baseDate = DateTime.fromISO(basePaymentDate, { zone: 'utc' })
      .plus({ months: condition.graceMonths })
      .toISODate()!;
    return buildFrenchSchedule({
      principal,
      purchaseDate,
      baseDate,
      numberOfInstallments: installmentCount,
      paymentDay: condition.dueDay,
      dailyRate,
    }).installments.map((installment) => ({
      id: this.generateId(),
      creditId,
      installmentNumber: installment.number,
      dueDate: installment.dueDate,
      openingBalance: precise(installment.openingBalance),
      // Capital originally consumed releases the account limit. The balance
      // created by total grace is charged as compensatory interest instead.
      principalDue: precise(installment.originalPrincipalRecoverable),
      originalPrincipalRecoverable: precise(installment.originalPrincipalRecoverable),
      compensatoryInterest: precise(
        installment.interest.plus(
          installment.amortization.minus(installment.originalPrincipalRecoverable),
        ),
      ),
      lateDailyRate: lateDailyRate.toFixed(15),
      amountDue: precise(installment.payment),
      paidAmount: '0.000000000000',
      status: 'PENDING' as const,
    }));
  }

  private async withRetry<T>(
    accountId: string,
    operation: (transaction: CreditOperationsTransaction) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.repository.withLockedAccount(accountId, operation);
      } catch (error) {
        if (!(error instanceof TransientTransactionError) || attempt === 3) throw error;
      }
    }
    throw new TransientTransactionError('No se pudo completar la transacción.');
  }
}
