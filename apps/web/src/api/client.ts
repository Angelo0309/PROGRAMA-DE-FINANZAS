import type { components } from './schema';

export type TokenPair = components['schemas']['TokenPair'];
export type StoreAccess = components['schemas']['StoreAccess'];
export type Profile = components['schemas']['Profile'];

export interface AccountView {
  id: string;
  accountNumber: string;
  customerName?: string;
  storeName?: string;
  creditLimit: string;
  originalOutstanding: string;
  currency: string;
}

export interface ProductView {
  id: string;
  name: string;
  unitPrice: string;
  currency: string;
  imageUrl: string | null;
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
  createInvitation(input: {
    email: string;
    platformRole: 'PLATFORM_ADMIN' | 'USER';
    storeId?: string;
    storeRole?: 'STORE_ADMIN' | 'OPERATOR' | 'CLIENT';
    expiresAt: string;
  }): Promise<{ id: string; token: string; expiresAt?: string }>;
  listAudit(): Promise<Array<{ id: string; event: string; createdAt: string }>>;
  listClients(storeId: string): Promise<Array<{ id: string; fullName: string }>>;
  listProducts(storeId: string): Promise<ProductView[]>;
  listAccounts(storeId: string): Promise<AccountView[]>;
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
    return this.request<Array<{ id: string; fullName: string }>>(
      `/stores/${storeId}/clients`,
    );
  }

  listProducts(storeId: string) {
    return this.request<ProductView[]>(`/stores/${storeId}/products`);
  }

  listAccounts(storeId: string) {
    return this.request<AccountView[]>(`/stores/${storeId}/accounts`);
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
}

export function createApiClient(
  baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
): ApiClient {
  return new HttpApiClient(baseUrl.replace(/\/$/, ''));
}
