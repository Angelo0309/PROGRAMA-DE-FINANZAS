import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    listProducts: vi.fn().mockResolvedValue([{
      id: 'product-1',
      sku: 'PROD-001',
      name: 'Producto Demo',
      description: 'Producto de prueba',
      unitPrice: '100.00',
      currency: 'PEN',
      imageUrl: 'https://images.example.com/producto-demo.jpg',
    }]),
    createProduct: vi.fn().mockResolvedValue({
      id: 'product-2',
      sku: 'PROD-002',
      name: 'Cafetera compacta',
      description: 'Cafetera para el hogar',
      unitPrice: '189.90',
      currency: 'PEN',
      imageUrl: 'https://images.example.com/cafetera.jpg',
    }),
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
  fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));
}

describe('App por roles', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('presents a validated sign-in entry point', () => {
    render(<App api={makeApi({}) as never} />);
    expect(screen.getByRole('heading', { name: 'CrediCuenta' })).toBeVisible();
    expect(screen.getByLabelText(/correo o usuario/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeVisible();
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
    const navigation = screen.getByRole('navigation', { name: /secciones/i });
    expect(within(navigation).getByText('Panel del negocio')).toBeVisible();
    expect(within(navigation).getByText('Productos y servicios')).toBeVisible();
    expect(within(navigation).getByText('Registrar compra')).toBeVisible();
    expect(within(navigation).getByText('Reporte de corte')).toBeVisible();
    await screen.findByRole('option', { name: /CC-001/i });
    fireEvent.change(screen.getByLabelText(/^cuenta$/i), { target: { value: 'account-1' } });
    fireEvent.change(screen.getByLabelText(/producto o servicio/i), { target: { value: 'product-1' } });
    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: '1' } });
    const purchaseForm = screen.getByLabelText(/^cuenta$/i).closest('form')!;
    fireEvent.click(within(purchaseForm).getByRole('button', { name: /registrar compra/i }));
    await waitFor(() => expect(api.createPurchase).toHaveBeenCalledWith('store-1', expect.objectContaining({ accountId: 'account-1', currency: 'PEN', items: [{ productId: 'product-1', quantity: '1' }] })));
    expect(await screen.findByText(/compra registrada por s\/ 100.00/i)).toBeVisible();
  });

  it('opens the product catalog and presents the image registered by the business', async () => {
    const api = makeApi({ id: 'admin-1', displayName: 'Admin Negocio', platformRole: 'USER', storeAccesses: [{ storeId: 'store-1', storeName: 'Bodega Demo', currency: 'PEN', role: 'STORE_ADMIN' }] });
    render(<App api={api as never} />);
    await login();

    fireEvent.click(await screen.findByRole('button', { name: 'Productos y servicios' }));

    expect(await screen.findByRole('heading', { name: 'Productos y servicios' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'Producto Demo' })).toHaveAttribute(
      'src',
      'https://images.example.com/producto-demo.jpg',
    );
    expect(screen.getByText('PROD-001')).toBeVisible();
  });

  it('creates a product with an optional image URL and adds it to the catalog', async () => {
    const api = makeApi({ id: 'admin-1', displayName: 'Admin Negocio', platformRole: 'USER', storeAccesses: [{ storeId: 'store-1', storeName: 'Bodega Demo', currency: 'PEN', role: 'STORE_ADMIN' }] });
    render(<App api={api as never} />);
    await login();
    fireEvent.click(await screen.findByRole('button', { name: 'Productos y servicios' }));
    fireEvent.click(screen.getByRole('button', { name: /nuevo producto o servicio/i }));

    fireEvent.change(screen.getByLabelText(/^código$/i), { target: { value: 'PROD-002' } });
    fireEvent.change(screen.getByLabelText(/^nombre$/i), { target: { value: 'Cafetera compacta' } });
    fireEvent.change(screen.getByLabelText(/^descripción$/i), { target: { value: 'Cafetera para el hogar' } });
    fireEvent.change(screen.getByLabelText(/^precio$/i), { target: { value: '189.90' } });
    fireEvent.change(screen.getByLabelText(/url de la imagen/i), { target: { value: 'https://images.example.com/cafetera.jpg' } });

    expect(screen.getByRole('img', { name: /vista previa de cafetera compacta/i })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /guardar producto/i }));

    await waitFor(() => expect(api.createProduct).toHaveBeenCalledWith('store-1', {
      sku: 'PROD-002',
      name: 'Cafetera compacta',
      description: 'Cafetera para el hogar',
      unitPrice: '189.90',
      currency: 'PEN',
      imageUrl: 'https://images.example.com/cafetera.jpg',
    }));
    expect(await screen.findByText('Producto guardado correctamente.')).toBeVisible();
    expect(screen.getByRole('img', { name: 'Cafetera compacta' })).toBeVisible();
  });

  it('does not submit a purchase command twice while the first request is pending', async () => {
    let finishPurchase: ((value: { id: string; total: string }) => void) | undefined;
    const api = makeApi({ id: 'operator-1', displayName: 'Operador', platformRole: 'USER', storeAccesses: [{ storeId: 'store-1', storeName: 'Bodega Demo', currency: 'PEN', role: 'OPERATOR' }] });
    api.createPurchase.mockImplementation(
      () => new Promise((resolve) => { finishPurchase = resolve; }),
    );
    render(<App api={api as never} />);
    await login();
    await screen.findByRole('option', { name: /CC-001/i });
    fireEvent.change(screen.getByLabelText(/^cuenta$/i), { target: { value: 'account-1' } });
    fireEvent.change(screen.getByLabelText(/producto o servicio/i), { target: { value: 'product-1' } });
    const form = screen.getByLabelText(/^cuenta$/i).closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(api.createPurchase).toHaveBeenCalledTimes(1);
    finishPurchase?.({ id: 'purchase-1', total: '100.00' });
    expect(await screen.findByText(/compra registrada/i)).toBeVisible();
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
