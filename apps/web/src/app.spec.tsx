import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './app';

function makeApi(profile: unknown) {
  return {
    login: vi.fn().mockResolvedValue({ accessToken: 'access-token', refreshToken: 'refresh-token', tokenType: 'Bearer', expiresIn: 900 }),
    getProfile: vi.fn().mockResolvedValue(profile),
    listStores: vi.fn().mockResolvedValue([]),
    listAudit: vi.fn().mockResolvedValue([]),
    createStore: vi.fn().mockResolvedValue({ id: 'store-1', name: 'Bodega Nueva' }),
    createInvitation: vi.fn().mockResolvedValue({ id: 'invitation-1', token: 'one-time-token' }),
    listClients: vi.fn().mockResolvedValue([]),
    listProducts: vi.fn().mockResolvedValue([{ id: 'product-1', name: 'Producto Demo', unitPrice: '100.00', currency: 'PEN' }]),
    listAccounts: vi.fn().mockResolvedValue([{ id: 'account-1', accountNumber: 'CC-001', customerName: 'Maria Demo', creditLimit: '1000.00', originalOutstanding: '100.00', currency: 'PEN' }]),
    createPurchase: vi.fn().mockResolvedValue({ id: 'purchase-1', total: '100.00' }),
    getMyAccounts: vi.fn().mockResolvedValue([{ id: 'account-1', storeName: 'Bodega Demo', accountNumber: 'CC-001', originalOutstanding: '100.00', creditLimit: '1000.00', currency: 'PEN' }]),
    getMyStatements: vi.fn().mockResolvedValue([]),
    getMyPurchases: vi.fn().mockResolvedValue([]),
  };
}

async function login() {
  fireEvent.change(screen.getByLabelText(/correo o usuario/i), { target: { value: 'demo@credicuenta.test' } });
  fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'DemoSegura#2026' } });
  fireEvent.click(screen.getByRole('button', { name: /ingresar/i }));
}

describe('App por roles', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('presents a validated sign-in entry point', () => {
    render(<App api={makeApi({}) as never} />);
    expect(screen.getByRole('heading', { name: 'CrediCuenta' })).toBeVisible();
    expect(screen.getByLabelText(/correo o usuario/i)).toBeVisible();
    expect(screen.getByText(/los importes oficiales provienen de la api/i)).toBeVisible();
  });

  it('routes a platform administrator to store and audit management', async () => {
    const api = makeApi({ id: 'admin-1', displayName: 'Admin Plataforma', platformRole: 'PLATFORM_ADMIN', storeAccesses: [] });
    render(<App api={api as never} />);
    await login();
    expect(await screen.findByRole('heading', { name: /control de plataforma/i })).toBeVisible();
    expect(api.listStores).toHaveBeenCalled();
    expect(screen.getByText(/tiendas registradas/i)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /nueva tienda/i }));
    fireEvent.change(screen.getByLabelText(/ruc o documento/i), { target: { value: '20123456780' } });
    fireEvent.change(screen.getByLabelText(/razón social/i), { target: { value: 'Bodega Nueva SAC' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar tienda/i }));
    await waitFor(() => expect(api.createStore).toHaveBeenCalledWith(expect.objectContaining({ taxId: '20123456780' })));
  });

  it('submits a business purchase using decimal strings from the API', async () => {
    const api = makeApi({ id: 'admin-1', displayName: 'Admin Negocio', platformRole: 'USER', storeAccesses: [{ storeId: 'store-1', storeName: 'Bodega Demo', currency: 'PEN', role: 'STORE_ADMIN' }] });
    render(<App api={api as never} />);
    await login();
    expect(await screen.findByRole('heading', { name: /mesa de crédito/i })).toBeVisible();
    await screen.findByRole('option', { name: /CC-001/i });
    fireEvent.change(screen.getByLabelText(/^cuenta$/i), { target: { value: 'account-1' } });
    fireEvent.change(screen.getByLabelText(/producto o servicio/i), { target: { value: 'product-1' } });
    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /registrar compra/i }));
    await waitFor(() => expect(api.createPurchase).toHaveBeenCalledWith('store-1', expect.objectContaining({ accountId: 'account-1', currency: 'PEN', items: [{ productId: 'product-1', quantity: '1' }] })));
    expect(await screen.findByText(/compra registrada por s\/ 100.00/i)).toBeVisible();
  });

  it('shows a client only their official account balances', async () => {
    const api = makeApi({ id: 'client-1', displayName: 'Maria Demo', platformRole: 'USER', storeAccesses: [{ storeId: 'store-1', storeName: 'Bodega Demo', currency: 'PEN', role: 'CLIENT' }] });
    render(<App api={api as never} />);
    await login();
    expect(await screen.findByRole('heading', { name: /mi credicuenta/i })).toBeVisible();
    expect(await screen.findByText('S/ 100.00')).toBeVisible();
    expect(api.getMyAccounts).toHaveBeenCalled();
  });
});
