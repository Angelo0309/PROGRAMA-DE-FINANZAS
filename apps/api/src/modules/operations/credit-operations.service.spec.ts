import { Decimal } from 'decimal.js';
import { beforeEach, describe, expect, it } from 'vitest';

import { CreditOperationsService } from './credit-operations.service.js';
import {
  type AccountSnapshot,
  type CreditConditionSnapshot,
  type CreditOperationsRepository,
  type CreditOperationsTransaction,
  type CutRecord,
  type PaymentRecord,
  type ProductSnapshot,
  type PurchaseRecord,
  TransientTransactionError,
} from './ports/credit-operations.repository.js';

class MemoryOperationsRepository
  implements CreditOperationsRepository, CreditOperationsTransaction
{
  account: AccountSnapshot = {
    id: 'account-1',
    storeId: 'store-1',
    currency: 'PEN',
    creditLimit: '1000.00',
    originalOutstanding: '0.00',
    active: true,
  };
  condition: CreditConditionSnapshot = {
    id: 'condition-1',
    accountId: 'account-1',
    compensatoryRateKind: 'EFFECTIVE_ANNUAL',
    compensatoryRate: '0',
    lateRateKind: 'EFFECTIVE_ANNUAL',
    lateRate: '0',
    billingDay: 26,
    dueDay: 5,
    maxInstallments: 12,
    graceMonths: 0,
  };
  products: ProductSnapshot[] = [
    {
      id: 'product-1',
      storeId: 'store-1',
      name: 'Producto Demo',
      unitPrice: '100.00',
      currency: 'PEN',
      active: true,
    },
  ];
  purchases: PurchaseRecord[] = [];
  cuts: CutRecord[] = [];
  payments: PaymentRecord[] = [];
  transientFailures = 0;
  attempts = 0;

  async withLockedAccount<T>(
    _accountId: string,
    operation: (transaction: CreditOperationsTransaction) => Promise<T>,
  ) {
    this.attempts += 1;
    if (this.transientFailures > 0) {
      this.transientFailures -= 1;
      throw new TransientTransactionError('deadlock');
    }
    return operation(this);
  }

  async findPurchaseByIdempotency(storeId: string, key: string) {
    return this.purchases.find((item) => item.storeId === storeId && item.idempotencyKey === key) ?? null;
  }
  async findCutByIdempotency(storeId: string, key: string) {
    return this.cuts.find((item) => item.storeId === storeId && item.idempotencyKey === key) ?? null;
  }
  async findPaymentByIdempotency(storeId: string, key: string) {
    return this.payments.find((item) => item.storeId === storeId && item.idempotencyKey === key) ?? null;
  }
  async getAccount(storeId: string, accountId: string) {
    return this.account.storeId === storeId && this.account.id === accountId ? this.account : null;
  }
  async getActiveCondition() {
    return this.condition;
  }
  async getProducts(storeId: string, productIds: string[]) {
    return this.products.filter((item) => item.storeId === storeId && productIds.includes(item.id));
  }
  async listObligationsForCut(accountId: string, cutAt: string) {
    return this.purchases
      .filter(
        (purchase) =>
          purchase.accountId === accountId &&
          purchase.mode === 'END_OF_MONTH' &&
          purchase.assignedCutAt <= cutAt,
      )
      .flatMap((purchase) => purchase.obligations)
      .filter((obligation) => !this.cuts.some((cut) => cut.obligationIds.includes(obligation.id)));
  }
  async listPayableObligations(accountId: string, paidOn: string) {
    return this.purchases
      .filter((purchase) => purchase.accountId === accountId)
      .flatMap((purchase) => purchase.obligations)
      .filter((obligation) => obligation.dueDate <= paidOn && obligation.status !== 'PAID');
  }
  async savePurchase(purchase: PurchaseRecord) {
    this.purchases.push(purchase);
    this.account.originalOutstanding = new Decimal(this.account.originalOutstanding)
      .plus(purchase.principal)
      .toString();
  }
  async saveCut(cut: CutRecord) {
    this.cuts.push(cut);
  }
  async savePayment(payment: PaymentRecord) {
    this.payments.push(payment);
    for (const allocation of payment.allocations) {
      const obligation = this.purchases
        .flatMap((purchase) => purchase.obligations)
        .find((item) => item.id === allocation.obligationId)!;
      obligation.status = 'PAID';
      obligation.paidAmount = payment.amount;
      const remaining = new Decimal(this.account.originalOutstanding).minus(
        obligation.originalPrincipalRecoverable,
      );
      this.account.originalOutstanding = remaining.abs().lte('0.000000000001')
        ? '0'
        : remaining.toString();
    }
  }
}

const basePurchase = {
  storeId: 'store-1',
  accountId: 'account-1',
  operatorUserId: 'operator-1',
  idempotencyKey: 'purchase-key-1',
  purchasedAt: '2026-10-20T10:00:00-05:00',
  currency: 'PEN',
  mode: 'END_OF_MONTH' as const,
  items: [{ productId: 'product-1', quantity: '1' }],
};

describe('CreditOperationsService', () => {
  let repository: MemoryOperationsRepository;
  let service: CreditOperationsService;
  let sequence: number;

  beforeEach(() => {
    repository = new MemoryOperationsRepository();
    sequence = 0;
    service = new CreditOperationsService(repository, () => `id-${++sequence}`);
  });

  it('creates an end-of-month purchase and returns decimal strings', async () => {
    const purchase = await service.createPurchase(basePurchase);

    expect(purchase.total).toBe('100.00');
    expect(purchase.obligations).toHaveLength(1);
    expect(purchase.obligations[0]).toMatchObject({
      principalDue: '100.000000000000',
      compensatoryInterest: '0.000000000000',
      amountDue: '100.000000000000',
    });
  });

  it('returns the original purchase for a repeated idempotency key', async () => {
    const first = await service.createPurchase(basePurchase);
    const repeated = await service.createPurchase(basePurchase);
    expect(repeated).toBe(first);
    expect(repository.purchases).toHaveLength(1);
  });

  it('rejects credit excess, wrong currency and excessive installments', async () => {
    repository.account.creditLimit = '99.99';
    await expect(service.createPurchase(basePurchase)).rejects.toMatchObject({ status: 409 });

    repository.account.creditLimit = '1000';
    await expect(service.createPurchase({ ...basePurchase, currency: 'USD' })).rejects.toMatchObject({ status: 400 });
    await expect(
      service.createPurchase({
        ...basePurchase,
        mode: 'INSTALLMENTS',
        installmentCount: 13,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('creates a cut once and includes eligible obligations', async () => {
    const purchase = await service.createPurchase(basePurchase);
    const input = {
      storeId: 'store-1',
      accountId: 'account-1',
      idempotencyKey: 'cut-key-1',
      cutAt: purchase.assignedCutAt,
    };
    const cut = await service.createCut(input);
    const repeated = await service.createCut(input);

    expect(cut.totalDue).toBe('100.00');
    expect(cut.obligationIds).toEqual([purchase.obligations[0]!.id]);
    expect(repeated).toBe(cut);
  });

  it('keeps installment schedules out of the end-of-month statement', async () => {
    const purchase = await service.createPurchase({
      ...basePurchase,
      mode: 'INSTALLMENTS',
      installmentCount: 3,
      idempotencyKey: 'installment-schedule',
    });
    const cut = await service.createCut({
      storeId: 'store-1',
      accountId: 'account-1',
      idempotencyKey: 'installment-cut',
      cutAt: purchase.assignedCutAt,
    });

    expect(cut.obligationIds).toEqual([]);
    expect(cut.totalDue).toBe('0.00');
  });

  it('accepts only an exact full payment and allocates mora, interest, then capital', async () => {
    const purchase = await service.createPurchase(basePurchase);
    const paidAt = `${purchase.obligations[0]!.dueDate}T12:00:00-05:00`;
    const input = {
      storeId: 'store-1',
      accountId: 'account-1',
      operatorUserId: 'operator-1',
      idempotencyKey: 'payment-key-1',
      paidAt,
      currency: 'PEN',
      amount: '100.00',
    };

    await expect(service.createPayment({ ...input, amount: '99.99' })).rejects.toMatchObject({ status: 400 });
    await expect(service.createPayment({ ...input, amount: '100.01' })).rejects.toMatchObject({ status: 400 });
    await expect(service.createPayment({ ...input, currency: 'USD' })).rejects.toMatchObject({ status: 400 });

    const payment = await service.createPayment(input);
    expect(payment.allocations[0]).toEqual({
      obligationId: purchase.obligations[0]!.id,
      lateInterestPaid: '0.00',
      compensatoryPaid: '0.00',
      principalPaid: '100.00',
    });
    expect(await service.createPayment(input)).toBe(payment);
  });

  it('keeps capitalized grace interest out of original-credit recovery', async () => {
    repository.products[0]!.unitPrice = '1200.00';
    repository.account.creditLimit = '2000.00';
    repository.condition = {
      ...repository.condition,
      compensatoryRate: '0.24',
      graceMonths: 1,
    };
    const purchase = await service.createPurchase({
      ...basePurchase,
      idempotencyKey: 'grace-interest',
      mode: 'INSTALLMENTS',
      installmentCount: 3,
    });
    const first = purchase.obligations[0]!;

    const payment = await service.createPayment({
      storeId: 'store-1',
      accountId: 'account-1',
      operatorUserId: 'operator-1',
      idempotencyKey: 'grace-payment',
      paidAt: `${first.dueDate}T12:00:00-05:00`,
      currency: 'PEN',
      amount: new Decimal(first.amountDue).toFixed(2),
    });

    expect(
      new Decimal(payment.allocations[0]!.principalPaid)
        .minus(first.principalDue)
        .abs()
        .lte('0.01'),
    ).toBe(true);
    expect(new Decimal(first.compensatoryInterest).gt('21.85')).toBe(true);
  });

  it('releases every exact original-principal share after rounded installments', async () => {
    const purchase = await service.createPurchase({
      ...basePurchase,
      idempotencyKey: 'one-hundred-in-three',
      mode: 'INSTALLMENTS',
      installmentCount: 3,
    });

    for (const [index, obligation] of purchase.obligations.entries()) {
      await service.createPayment({
        storeId: 'store-1',
        accountId: 'account-1',
        operatorUserId: 'operator-1',
        idempotencyKey: `installment-${index}`,
        paidAt: `${obligation.dueDate}T12:00:00-05:00`,
        currency: 'PEN',
        amount: new Decimal(obligation.amountDue).toFixed(2),
      });
    }

    expect(repository.account.originalOutstanding).toBe('0');
  });

  it('retries transient serialization conflicts at most three times', async () => {
    repository.transientFailures = 2;
    await service.createPurchase(basePurchase);
    expect(repository.attempts).toBe(3);

    const failing = new MemoryOperationsRepository();
    failing.transientFailures = 3;
    const failingService = new CreditOperationsService(failing, () => 'id');
    await expect(failingService.createPurchase(basePurchase)).rejects.toBeInstanceOf(TransientTransactionError);
    expect(failing.attempts).toBe(3);
  });
});
