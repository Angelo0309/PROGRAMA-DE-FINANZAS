export type PurchaseMode = 'END_OF_MONTH' | 'INSTALLMENTS';

export interface AccountSnapshot {
  id: string;
  storeId: string;
  currency: string;
  creditLimit: string;
  originalOutstanding: string;
  active: boolean;
}

export interface CreditConditionSnapshot {
  id: string;
  accountId: string;
  compensatoryRateKind: 'EFFECTIVE_ANNUAL' | 'NOMINAL_ANNUAL';
  compensatoryRate: string;
  lateRateKind: 'EFFECTIVE_ANNUAL' | 'NOMINAL_ANNUAL';
  lateRate: string;
  billingDay: number;
  dueDay: number;
  maxInstallments: number;
  graceMonths: number;
}

export interface ProductSnapshot {
  id: string;
  storeId: string;
  name: string;
  unitPrice: string;
  currency: string;
  active: boolean;
}

export interface ObligationRecord {
  id: string;
  creditId: string;
  installmentNumber: number;
  dueDate: string;
  openingBalance: string;
  principalDue: string;
  originalPrincipalRecoverable: string;
  compensatoryInterest: string;
  lateDailyRate: string;
  amountDue: string;
  paidAmount: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
}

export interface PurchaseRecord {
  id: string;
  storeId: string;
  accountId: string;
  conditionId: string;
  operatorUserId: string;
  idempotencyKey: string;
  mode: PurchaseMode;
  installmentCount: number | null;
  purchasedAt: string;
  assignedCutAt: string;
  currency: string;
  principal: string;
  total: string;
  lines: Array<{
    id: string;
    productId: string;
    description: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
  }>;
  obligations: ObligationRecord[];
}

export interface CutRecord {
  id: string;
  storeId: string;
  accountId: string;
  idempotencyKey: string;
  cutAt: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  currency: string;
  totalDue: string;
  obligationIds: string[];
}

export interface PaymentAllocation {
  obligationId: string;
  lateInterestPaid: string;
  compensatoryPaid: string;
  principalPaid: string;
}

export interface PaymentRecord {
  id: string;
  storeId: string;
  accountId: string;
  operatorUserId: string;
  idempotencyKey: string;
  paidAt: string;
  currency: string;
  amount: string;
  receiptNumber: string;
  allocations: PaymentAllocation[];
}

export interface CreditOperationsTransaction {
  findPurchaseByIdempotency(
    storeId: string,
    idempotencyKey: string,
  ): Promise<PurchaseRecord | null>;
  findCutByIdempotency(
    storeId: string,
    idempotencyKey: string,
  ): Promise<CutRecord | null>;
  findPaymentByIdempotency(
    storeId: string,
    idempotencyKey: string,
  ): Promise<PaymentRecord | null>;
  getAccount(storeId: string, accountId: string): Promise<AccountSnapshot | null>;
  getActiveCondition(accountId: string, at: string): Promise<CreditConditionSnapshot | null>;
  getProducts(storeId: string, productIds: string[]): Promise<ProductSnapshot[]>;
  listObligationsForCut(accountId: string, cutAt: string): Promise<ObligationRecord[]>;
  listPayableObligations(accountId: string, paidOn: string): Promise<ObligationRecord[]>;
  savePurchase(purchase: PurchaseRecord): Promise<void>;
  saveCut(cut: CutRecord): Promise<void>;
  savePayment(payment: PaymentRecord): Promise<void>;
}

export interface CreditOperationsRepository {
  withLockedAccount<T>(
    accountId: string,
    operation: (transaction: CreditOperationsTransaction) => Promise<T>,
  ): Promise<T>;
}

export class TransientTransactionError extends Error {}
