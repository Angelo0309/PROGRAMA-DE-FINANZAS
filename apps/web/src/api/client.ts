import type { components } from './schema';

export type TokenPair = components['schemas']['TokenPair'];
export type StoreAccess = components['schemas']['StoreAccess'];
export type Profile = components['schemas']['Profile'];

export interface AccountView {
  id: string;
  accountNumber: string;
  customerId?: string;
  customerName?: string;
  storeName?: string;
  creditLimit: string;
  originalOutstanding: string;
  currency: string;
  currentCondition?: CreditConditionView;
}

export interface CreditConditionView {
  id: string;
  version: number;
  compensatoryRateKind: 'EFFECTIVE_ANNUAL' | 'NOMINAL_ANNUAL';
  compensatoryRate: string;
  lateRateKind: 'EFFECTIVE_ANNUAL' | 'NOMINAL_ANNUAL';
  lateRate: string;
  billingDay: number;
  dueDay: number;
  maxInstallments: number;
  graceMonths: number;
  validFrom: string;
  validUntil: string | null;
}

export interface CreditConditionInput {
  storeId: string;
  compensatoryRateKind: 'EFFECTIVE_ANNUAL' | 'NOMINAL_ANNUAL';
  compensatoryRate: string;
  lateRateKind: 'EFFECTIVE_ANNUAL' | 'NOMINAL_ANNUAL';
  lateRate: string;
  billingDay: number;
  dueDay: number;
  maxInstallments: number;
  graceMonths: number;
  validFrom: string;
}

export interface ScheduleItemView {
  id: string;
  purchaseId: string;
  installmentNumber: number;
  dueDate: string;
  openingBalance: string;
  principalDue: string;
  compensatoryInterest: string;
  lateInterest: string;
  amountDue: string;
  paidAmount: string;
  currency: string;
  status: string;
}

export interface PaymentQuoteView {
  accountId: string;
  paidOn: string;
  currency: string;
  amount: string;
  obligations: Array<{
    id: string;
    dueDate: string;
    lateDays: number;
    lateInterest: string;
    compensatoryInterest: string;
    principal: string;
  }>;
}

export interface PaymentReceiptView {
  id: string;
  receiptNumber: string;
  paidAt: string;
  currency: string;
  amount: string;
  allocations: Array<{
    obligationId: string;
    lateInterestPaid: string;
    compensatoryPaid: string;
    principalPaid: string;
  }>;
}

export interface ClientPaymentView extends PaymentReceiptView {
  accountId: string;
  method: string;
}

export interface StatementView {
  id: string;
  cutAt: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  currency: string;
  totalDue: string;
}

export interface ClientView {
  id: string;
  documentType: string;
  documentNumber: string;
  fullName: string;
  phone: string | null;
  address: string | null;
}

export interface CreateClientInput {
  documentType: string;
  documentNumber: string;
  fullName: string;
  phone?: string;
  address?: string;
}

export interface ProductView {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unitPrice: string;
  currency: string;
  imageUrl: string | null;
}

export interface CreateProductInput {
  sku: string;
  name: string;
  description?: string;
  unitPrice: string;
  currency: string;
  imageUrl?: string;
}

export interface PurchaseItemView {
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  imageUrl: string | null;
}

export interface PurchaseView {
  id: string;
  purchasedAt: string;
  total: string;
  currency: string;
  items: PurchaseItemView[];
}

export interface ApiClient {
  login(input: { identifier: string; password: string }): Promise<TokenPair>;
  getProfile(): Promise<Profile>;
  listStores(): Promise<Array<{ id: string; name: string; active: boolean }>>;
  createStore(input: {
    taxId: string;
    name: string;
    tradeName?: string;
    currency: string;
    timeZone: string;
  }): Promise<{ id: string; name: string; active?: boolean }>;
  deactivateStore(storeId: string): Promise<{ id: string; active: false }>;
  createInvitation(input: {
    email: string;
    platformRole: 'PLATFORM_ADMIN' | 'USER';
    storeId?: string;
    storeRole?: 'STORE_ADMIN' | 'OPERATOR' | 'CLIENT';
    expiresAt: string;
  }): Promise<{ id: string; token: string; expiresAt?: string }>;
  listAudit(): Promise<Array<{ id: string; event: string; createdAt: string }>>;
  listClients(storeId: string): Promise<ClientView[]>;
  createClient(storeId: string, input: CreateClientInput): Promise<ClientView>;
  listProducts(storeId: string): Promise<ProductView[]>;
  createProduct(storeId: string, input: CreateProductInput): Promise<ProductView>;
  listAccounts(storeId: string): Promise<AccountView[]>;
  createAccount(storeId: string, input: {
    customerId: string;
    accountNumber: string;
    currency: string;
    creditLimit: string;
    initialCondition?: Omit<CreditConditionInput, 'storeId'>;
  }): Promise<AccountView>;
  addCreditCondition(accountId: string, input: CreditConditionInput): Promise<CreditConditionView>;
  getSchedule(accountId: string, storeId: string): Promise<ScheduleItemView[]>;
  getPaymentQuote(accountId: string, storeId: string, paidAt: string): Promise<PaymentQuoteView>;
  createPayment(accountId: string, input: {
    storeId: string;
    paidAt: string;
    currency: string;
    amount: string;
    idempotencyKey?: string;
  }): Promise<{ id: string; receiptNumber: string; currency: string; amount: string }>;
  getReceipt(paymentId: string, storeId: string): Promise<PaymentReceiptView>;
  getStatements(accountId: string, storeId: string): Promise<StatementView[]>;
  createPurchase(
    storeId: string,
    input: {
      accountId: string;
      purchasedAt: string;
      currency: string;
      mode: 'END_OF_MONTH' | 'INSTALLMENTS';
      installmentCount?: number;
      items: Array<{ productId: string; quantity: string }>;
      idempotencyKey?: string;
    },
  ): Promise<{ id: string; total: string }>;
  getMyAccounts(): Promise<AccountView[]>;
  getMyStatements(): Promise<
    Array<{ id: string; dueDate: string; totalDue: string; currency: string }>
  >;
  getMyPurchases(): Promise<PurchaseView[]>;
  getMySchedule(): Promise<ScheduleItemView[]>;
  getMyPayments(): Promise<ClientPaymentView[]>;
}

export const ACCESS_TOKEN_KEY = 'credicuenta.accessToken';
export const REFRESH_TOKEN_KEY = 'credicuenta.refreshToken';

class HttpApiClient implements ApiClient {
  constructor(private readonly baseUrl: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
    if (!response.ok) {
      const problem = (await response.json().catch(() => null)) as
        | { message?: string | string[] }
        | null;
      const message = Array.isArray(problem?.message)
        ? problem.message.join(' ')
        : problem?.message;
      throw new Error(message ?? `La API respondió con estado ${response.status}.`);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  login(input: { identifier: string; password: string }) {
    return this.request<TokenPair>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  getProfile() {
    return this.request<Profile>('/me/profile');
  }

  listStores() {
    return this.request<Array<{ id: string; name: string; active: boolean }>>(
      '/platform/stores',
    );
  }

  createStore(input: Parameters<ApiClient['createStore']>[0]) {
    return this.request<{ id: string; name: string; active?: boolean }>(
      '/platform/stores',
      { method: 'POST', body: JSON.stringify(input) },
    );
  }

  deactivateStore(storeId: string) {
    return this.request<{ id: string; active: false }>(`/platform/stores/${storeId}`, {
      method: 'DELETE',
    });
  }

  createInvitation(input: Parameters<ApiClient['createInvitation']>[0]) {
    return this.request<{ id: string; token: string; expiresAt?: string }>(
      '/platform/invitations',
      { method: 'POST', body: JSON.stringify(input) },
    );
  }

  listAudit() {
    return this.request<Array<{ id: string; event: string; createdAt: string }>>(
      '/platform/audit',
    );
  }

  listClients(storeId: string) {
    return this.request<ClientView[]>(`/stores/${storeId}/clients`);
  }

  createClient(storeId: string, input: CreateClientInput) {
    return this.request<ClientView>(`/stores/${storeId}/clients`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  listProducts(storeId: string) {
    return this.request<ProductView[]>(`/stores/${storeId}/products`);
  }

  createProduct(storeId: string, input: CreateProductInput) {
    return this.request<ProductView>(`/stores/${storeId}/products`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  listAccounts(storeId: string) {
    return this.request<AccountView[]>(`/stores/${storeId}/accounts`);
  }

  createAccount(storeId: string, input: Parameters<ApiClient['createAccount']>[1]) {
    return this.request<AccountView>(`/stores/${storeId}/accounts`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  addCreditCondition(accountId: string, input: CreditConditionInput) {
    return this.request<CreditConditionView>(`/accounts/${accountId}/credit-conditions`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  getSchedule(accountId: string, storeId: string) {
    return this.request<ScheduleItemView[]>(
      `/accounts/${accountId}/schedule?storeId=${encodeURIComponent(storeId)}`,
    );
  }

  getPaymentQuote(accountId: string, storeId: string, paidAt: string) {
    const query = new URLSearchParams({ storeId, paidAt });
    return this.request<PaymentQuoteView>(`/accounts/${accountId}/payment-quote?${query.toString()}`);
  }

  createPayment(accountId: string, input: Parameters<ApiClient['createPayment']>[1]) {
    const { idempotencyKey, ...command } = input;
    return this.request<{ id: string; receiptNumber: string; currency: string; amount: string }>(
      `/accounts/${accountId}/payments`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey ?? crypto.randomUUID() },
        body: JSON.stringify(command),
      },
    );
  }

  getReceipt(paymentId: string, storeId: string) {
    return this.request<PaymentReceiptView>(
      `/payments/${paymentId}/receipt?storeId=${encodeURIComponent(storeId)}`,
    );
  }

  getStatements(accountId: string, storeId: string) {
    return this.request<StatementView[]>(
      `/accounts/${accountId}/statements?storeId=${encodeURIComponent(storeId)}`,
    );
  }

  createPurchase(
    storeId: string,
    input: Parameters<ApiClient['createPurchase']>[1],
  ) {
    const { idempotencyKey, ...command } = input;
    return this.request<{ id: string; total: string }>(
      `/stores/${storeId}/purchases`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey ?? crypto.randomUUID() },
        body: JSON.stringify(command),
      },
    );
  }

  getMyAccounts() {
    return this.request<AccountView[]>('/me/accounts');
  }

  getMyStatements() {
    return this.request<
      Array<{ id: string; dueDate: string; totalDue: string; currency: string }>
    >('/me/statements');
  }

  getMyPurchases() {
    return this.request<PurchaseView[]>('/me/purchases');
  }

  getMySchedule() {
    return this.request<ScheduleItemView[]>('/me/schedule');
  }

  getMyPayments() {
    return this.request<ClientPaymentView[]>('/me/payments');
  }
}

export function createApiClient(
  baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
): ApiClient {
  return new HttpApiClient(baseUrl.replace(/\/$/, ''));
}
