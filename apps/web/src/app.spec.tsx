import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App, localDateInTimeZone } from './app';

function makeApi(profile: unknown) {
  return {
    login: vi.fn().mockResolvedValue({ accessToken: 'access-token', refreshToken: 'refresh-token', tokenType: 'Bearer', expiresIn: 900 }),
    getProfile: vi.fn().mockResolvedValue(profile),
    listStores: vi.fn().mockResolvedValue([]),
    listAudit: vi.fn().mockResolvedValue([]),
    createStore: vi.fn().mockResolvedValue({ id: 'store-1', name: 'Bodega Nueva' }),
    createInvitation: vi.fn().mockResolvedValue({ id: 'invitation-1', token: 'one-time-token' }),
    listClients: vi.fn().mockResolvedValue([{
      id: 'client-1',
      documentType: 'DNI',
      documentNumber: '70481236',
      fullName: 'Maria Demo',
      phone: '999111222',
      address: 'Lima',
    }]),
    createClient: vi.fn().mockResolvedValue({
      id: 'client-2',
      documentType: 'DNI',
      documentNumber: '76123456',
      fullName: 'Ana Torres',
      phone: '988776655',
      address: 'San Miguel',
    }),
    listProducts: vi.fn().mockResolvedValue([
      {
        id: 'product-1',
        sku: 'PROD-001',
        name: 'Producto Demo',
        description: 'Producto de prueba',
        unitPrice: '100.00',
        currency: 'PEN',
        imageUrl: 'https://images.example.com/producto-demo.jpg',
      },
      {
        id: 'product-2',
        sku: 'PROD-002',
        name: 'Audífonos inalámbricos',
        description: 'Accesorio de audio',
        unitPrice: '89.90',
        currency: 'PEN',
        imageUrl: 'https://images.example.com/audifonos.jpg',
      },
    ]),
    createProduct: vi.fn().mockResolvedValue({
      id: 'product-3',
      sku: 'PROD-002',
      name: 'Cafetera compacta',
      description: 'Cafetera para el hogar',
      unitPrice: '189.90',
      currency: 'PEN',
      imageUrl: 'https://images.example.com/cafetera.jpg',
    }),
    listAccounts: vi.fn().mockResolvedValue([{
      id: 'account-1',
      accountNumber: 'CC-001',
      customerId: 'client-1',
      customerName: 'Maria Demo',
      creditLimit: '1000.00',
      originalOutstanding: '100.00',
      currency: 'PEN',
      currentCondition: {
        id: 'condition-1',
        version: 1,
        compensatoryRateKind: 'EFFECTIVE_ANNUAL',
        compensatoryRate: '0.240000000000',
        lateRateKind: 'NOMINAL_ANNUAL',
        lateRate: '0.360000000000',
        billingDay: 20,
        dueDay: 28,
        maxInstallments: 6,
        graceMonths: 0,
        validFrom: '2026-10-01T05:00:00.000Z',
        validUntil: null,
      },
    }]),
    createAccount: vi.fn().mockResolvedValue({
      id: 'account-2', accountNumber: 'CC-002', customerId: 'client-1', creditLimit: '2000.00', originalOutstanding: '0.00', currency: 'PEN',
      currentCondition: { id: 'condition-2', version: 1, compensatoryRateKind: 'EFFECTIVE_ANNUAL', compensatoryRate: '0.240000000000', lateRateKind: 'EFFECTIVE_ANNUAL', lateRate: '0.360000000000', billingDay: 20, dueDay: 28, maxInstallments: 6, graceMonths: 0, validFrom: '2026-11-01T05:00:00.000Z', validUntil: null },
    }),
    addCreditCondition: vi.fn().mockResolvedValue({
      id: 'condition-2',
      version: 1,
      compensatoryRateKind: 'EFFECTIVE_ANNUAL',
      compensatoryRate: '0.240000000000',
      lateRateKind: 'EFFECTIVE_ANNUAL',
      lateRate: '0.360000000000',
      billingDay: 20,
      dueDay: 28,
      maxInstallments: 6,
      graceMonths: 0,
      validFrom: '2026-11-01T05:00:00.000Z',
      validUntil: null,
    }),
    getSchedule: vi.fn().mockResolvedValue([
      { id: 'obligation-voided', purchaseId: 'purchase-0', installmentNumber: 1, dueDate: '2026-09-28', openingBalance: '90.00', principalDue: '90.00', compensatoryInterest: '0.00', lateInterest: '0.00', amountDue: '90.00', paidAmount: '0.00', currency: 'PEN', status: 'VOIDED' },
      { id: 'obligation-1', purchaseId: 'purchase-1', installmentNumber: 1, dueDate: '2026-11-28', openingBalance: '300.00', principalDue: '95.00', compensatoryInterest: '5.00', lateInterest: '0.00', amountDue: '100.00', paidAmount: '0.00', currency: 'PEN', status: 'PENDING' },
      { id: 'obligation-2', purchaseId: 'purchase-1', installmentNumber: 2, dueDate: '2026-12-28', openingBalance: '205.00', principalDue: '98.00', compensatoryInterest: '2.00', lateInterest: '0.00', amountDue: '100.00', paidAmount: '0.00', currency: 'PEN', status: 'PENDING' },
      { id: 'obligation-3', purchaseId: 'purchase-2', installmentNumber: 1, dueDate: '2026-10-28', openingBalance: '50.00', principalDue: '50.00', compensatoryInterest: '0.00', lateInterest: '1.00', amountDue: '51.00', paidAmount: '0.00', currency: 'PEN', status: 'OVERDUE' },
    ]),
    getPaymentQuote: vi.fn().mockResolvedValue({
      accountId: 'account-1',
      paidOn: '2026-11-01',
      currency: 'PEN',
      amount: '51.20',
      obligations: [{ id: 'obligation-3', dueDate: '2026-10-28', lateDays: 3, lateInterest: '1.20', compensatoryInterest: '0.00', principal: '50.00' }],
    }),
    createPayment: vi.fn().mockResolvedValue({ id: 'payment-1', receiptNumber: 'RC-000001', amount: '51.20', currency: 'PEN' }),
    getReceipt: vi.fn().mockResolvedValue({
      id: 'payment-1', receiptNumber: 'RC-000001', paidAt: '2026-11-01T10:00:00-05:00', currency: 'PEN', amount: '51.20',
      allocations: [
        { obligationId: 'obligation-3', lateInterestPaid: '1.20', compensatoryPaid: '0.00', principalPaid: '50.00' },
        { obligationId: 'obligation-4', lateInterestPaid: '2.00', compensatoryPaid: '3.00', principalPaid: '45.00' },
      ],
    }),
    getStatements: vi.fn().mockResolvedValue([
      { id: 'cut-1', cutAt: '2026-10-21T04:59:59.000Z', periodStart: '2026-09-21', periodEnd: '2026-10-20', dueDate: '2026-10-28', currency: 'PEN', totalDue: '255.80' },
      { id: 'cut-large', cutAt: '2026-09-21T04:59:59.000Z', periodStart: '2026-08-21', periodEnd: '2026-09-20', dueDate: '2026-09-28', currency: 'PEN', totalDue: '9007199254740993.01' },
    ]),
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

describe('local commercial dates', () => {
  it('uses the Lima calendar day instead of UTC', () => {
    expect(localDateInTimeZone(new Date('2026-11-02T00:30:00.000Z'), 'America/Lima')).toBe('2026-11-01');
  });
});

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
    await waitFor(() => expect(api.listStores).toHaveBeenCalled());
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
    fireEvent.click(within(navigation).getByRole('button', { name: 'Registrar compra' }));
    expect(await screen.findByRole('heading', { name: 'Registrar compra' })).toBeVisible();
    await screen.findByRole('option', { name: /CC-001/i });
    fireEvent.change(screen.getByLabelText(/^cuenta$/i), { target: { value: 'account-1' } });
    fireEvent.change(screen.getByLabelText(/producto o servicio/i), { target: { value: 'product-1' } });
    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /agregar al detalle/i }));
    const purchaseForm = screen.getByRole('form', { name: /registro de compra/i });
    fireEvent.click(within(purchaseForm).getByRole('button', { name: /registrar compra/i }));
    await waitFor(() => expect(api.createPurchase).toHaveBeenCalledWith('store-1', expect.objectContaining({ accountId: 'account-1', currency: 'PEN', items: [{ productId: 'product-1', quantity: '1' }] })));
    await waitFor(() => expect(api.listAccounts).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/compra registrada por s\/ 100.00/i)).toBeVisible();
  });

  it('registers an installment purchase with multiple product lines', async () => {
    const api = makeApi({ id: 'admin-1', displayName: 'Admin Negocio', platformRole: 'USER', storeAccesses: [{ storeId: 'store-1', storeName: 'Bodega Demo', currency: 'PEN', role: 'STORE_ADMIN' }] });
    api.createPurchase.mockResolvedValue({ id: 'purchase-2', total: '289.90' });
    render(<App api={api as never} />);
    await login();

    const navigation = await screen.findByRole('navigation', { name: /secciones/i });
    fireEvent.click(within(navigation).getByRole('button', { name: 'Registrar compra' }));
    await screen.findByRole('heading', { name: 'Registrar compra' });
    fireEvent.change(screen.getByLabelText(/^cuenta$/i), { target: { value: 'account-1' } });

    fireEvent.change(screen.getByLabelText(/producto o servicio/i), { target: { value: 'product-1' } });
    fireEvent.change(screen.getByLabelText(/^cantidad$/i), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /agregar al detalle/i }));
    fireEvent.change(screen.getByLabelText(/producto o servicio/i), { target: { value: 'product-2' } });
    fireEvent.change(screen.getByLabelText(/^cantidad$/i), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /agregar al detalle/i }));

    fireEvent.change(screen.getByLabelText(/modalidad de pago/i), { target: { value: 'INSTALLMENTS' } });
    fireEvent.change(screen.getByLabelText(/número de cuotas/i), { target: { value: '3' } });
    const form = screen.getByRole('form', { name: /registro de compra/i });
    fireEvent.click(within(form).getByRole('button', { name: /registrar compra/i }));

    await waitFor(() => expect(api.createPurchase).toHaveBeenCalledWith('store-1', {
      accountId: 'account-1',
      purchasedAt: expect.any(String),
      currency: 'PEN',
      mode: 'INSTALLMENTS',
      installmentCount: 3,
      items: [
        { productId: 'product-1', quantity: '2' },
        { productId: 'product-2', quantity: '1' },
      ],
      idempotencyKey: expect.any(String),
    }));
    expect(await screen.findByText(/compra registrada por s\/ 289.90/i)).toBeVisible();
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

  it('opens client management with identity and official account balances', async () => {
    const api = makeApi({ id: 'admin-1', displayName: 'Admin Negocio', platformRole: 'USER', storeAccesses: [{ storeId: 'store-1', storeName: 'Bodega Demo', currency: 'PEN', role: 'STORE_ADMIN' }] });
    render(<App api={api as never} />);
    await login();

    fireEvent.click(await screen.findByRole('button', { name: 'Clientes' }));

    expect(await screen.findByRole('heading', { name: 'Gestión de clientes' })).toBeVisible();
    const clientTable = screen.getByRole('table', { name: 'Clientes y cuentas' });
    expect(within(clientTable).getByText('Maria Demo')).toBeVisible();
    expect(within(clientTable).getByText('DNI 70481236')).toBeVisible();
    expect(within(clientTable).getByText('S/ 900.00')).toBeVisible();
  });

  it('creates a client and includes it in the business directory', async () => {
    const api = makeApi({ id: 'admin-1', displayName: 'Admin Negocio', platformRole: 'USER', storeAccesses: [{ storeId: 'store-1', storeName: 'Bodega Demo', currency: 'PEN', role: 'STORE_ADMIN' }] });
    render(<App api={api as never} />);
    await login();
    fireEvent.click(await screen.findByRole('button', { name: 'Clientes' }));
    fireEvent.click(screen.getByRole('button', { name: /nuevo cliente/i }));

    fireEvent.change(screen.getByLabelText(/tipo de documento/i), { target: { value: 'DNI' } });
    fireEvent.change(screen.getByLabelText(/número de documento/i), { target: { value: '76123456' } });
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Ana Torres' } });
    fireEvent.change(screen.getByLabelText(/^teléfono$/i), { target: { value: '988776655' } });
    fireEvent.change(screen.getByLabelText(/^dirección$/i), { target: { value: 'San Miguel' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cliente/i }));

    await waitFor(() => expect(api.createClient).toHaveBeenCalledWith('store-1', {
      documentType: 'DNI',
      documentNumber: '76123456',
      fullName: 'Ana Torres',
      phone: '988776655',
      address: 'San Miguel',
    }));
    expect(await screen.findByText('Cliente guardado correctamente.')).toBeVisible();
    expect(within(screen.getByRole('table', { name: 'Clientes y cuentas' })).getByRole('button', { name: 'Ana Torres' })).toBeVisible();
  });

  it('creates a credit account together with its initial financial condition', async () => {
    const api = makeApi({ id: 'admin-1', displayName: 'Admin Negocio', platformRole: 'USER', storeAccesses: [{ storeId: 'store-1', storeName: 'Bodega Demo', currency: 'PEN', role: 'STORE_ADMIN' }] });
    render(<App api={api as never} />);
    await login();
    const navigation = await screen.findByRole('navigation', { name: /secciones/i });
    fireEvent.click(within(navigation).getByRole('button', { name: 'Cuentas corrientes' }));

    expect(await screen.findByRole('heading', { name: 'Cuentas corrientes', level: 1 })).toBeVisible();
    expect(screen.getByText('Nominal anual')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /nueva cuenta/i }));
    fireEvent.change(screen.getByLabelText(/^cliente$/i), { target: { value: 'client-1' } });
    fireEvent.change(screen.getByLabelText(/número de cuenta/i), { target: { value: 'CC-002' } });
    fireEvent.change(screen.getByLabelText(/límite de crédito/i), { target: { value: '2000.00' } });
    fireEvent.change(screen.getByLabelText(/tasa compensatoria/i), { target: { value: '0.24' } });
    fireEvent.change(screen.getByLabelText(/tasa moratoria/i), { target: { value: '0.36' } });
    fireEvent.change(screen.getByLabelText(/día de corte/i), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText(/día de vencimiento/i), { target: { value: '28' } });
    fireEvent.change(screen.getByLabelText(/máximo de cuotas/i), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText(/meses de gracia/i), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/vigente desde/i), { target: { value: '2026-11-01' } });
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await waitFor(() => expect(api.createAccount).toHaveBeenCalledWith('store-1', {
      customerId: 'client-1',
      accountNumber: 'CC-002',
      currency: 'PEN',
      creditLimit: '2000.00',
      initialCondition: {
        compensatoryRateKind: 'EFFECTIVE_ANNUAL',
        compensatoryRate: '0.24',
        lateRateKind: 'EFFECTIVE_ANNUAL',
        lateRate: '0.36',
        billingDay: 20,
        dueDay: 28,
        maxInstallments: 6,
        graceMonths: 0,
        validFrom: '2026-11-01T00:00:00-05:00',
      },
    }));
    expect(api.addCreditCondition).not.toHaveBeenCalled();
    expect(await screen.findByText(/cuenta y condición crediticia guardadas/i)).toBeVisible();
  });

  it('shows the official installment schedule returned by the API', async () => {
    const api = makeApi({ id: 'admin-1', displayName: 'Admin Negocio', platformRole: 'USER', storeAccesses: [{ storeId: 'store-1', storeName: 'Bodega Demo', currency: 'PEN', role: 'STORE_ADMIN' }] });
    render(<App api={api as never} />);
    await login();
    const navigation = await screen.findByRole('navigation', { name: /secciones/i });
    fireEvent.click(within(navigation).getByRole('button', { name: 'Planes de pago' }));

    expect(await screen.findByRole('heading', { name: 'Planes de pago' })).toBeVisible();
    fireEvent.change(screen.getByLabelText(/cuenta del cliente/i), { target: { value: 'account-1' } });
    await waitFor(() => expect(api.getSchedule).toHaveBeenCalledWith('account-1', 'store-1'));
    const schedule = await screen.findByRole('table', { name: /cronograma de pagos/i });
    expect(within(schedule).getByText('28/11/2026')).toBeVisible();
    expect(within(schedule).getAllByText('S/ 100.00')).toHaveLength(2);
    expect(within(schedule).getAllByText('Pendiente')).toHaveLength(2);
    expect(within(schedule).getByText('Vencida')).toBeVisible();
    expect(within(schedule).getByText('Anulada')).toBeVisible();
    expect(within(screen.getByLabelText('Resumen del plan de pago')).getByText('28/11/2026')).toBeVisible();
  });

  it('clears an old schedule while a different account is loading', async () => {
    let finishSecond: ((value: unknown[]) => void) | undefined;
    const api = makeApi({ id: 'admin-1', displayName: 'Admin Negocio', platformRole: 'USER', storeAccesses: [{ storeId: 'store-1', storeName: 'Bodega Demo', currency: 'PEN', role: 'STORE_ADMIN' }] });
    const accounts = await api.listAccounts();
    api.listAccounts.mockResolvedValue([...accounts, { ...accounts[0], id: 'account-2', accountNumber: 'CC-002', customerName: 'Ana Torres' }]);
    api.getSchedule.mockImplementation((accountId: string) => accountId === 'account-1'
      ? Promise.resolve([{ id: 'old-row', purchaseId: 'purchase-1', installmentNumber: 1, dueDate: '2026-11-28', openingBalance: '100.00', principalDue: '95.00', compensatoryInterest: '5.00', lateInterest: '0.00', amountDue: '100.00', paidAmount: '0.00', currency: 'PEN', status: 'PENDING' }])
      : new Promise((resolve) => { finishSecond = resolve; }));
    render(<App api={api as never} />);
    await login();
    const navigation = await screen.findByRole('navigation', { name: /secciones/i });
    fireEvent.click(within(navigation).getByRole('button', { name: 'Planes de pago' }));
    const selector = screen.getByLabelText(/cuenta del cliente/i);
    fireEvent.change(selector, { target: { value: 'account-1' } });
    await waitFor(() => expect(screen.getAllByText('28/11/2026')).toHaveLength(2));

    fireEvent.change(selector, { target: { value: 'account-2' } });
    await waitFor(() => expect(screen.queryAllByText('28/11/2026')).toHaveLength(0));
    finishSecond?.([]);
  });

  it('registers the exact full payment quoted by the API and presents its receipt', async () => {
    const api = makeApi({ id: 'operator-1', displayName: 'Operador', platformRole: 'USER', storeAccesses: [{ storeId: 'store-1', storeName: 'Bodega Demo', currency: 'PEN', role: 'OPERATOR' }] });
    render(<App api={api as never} />);
    await login();
    const navigation = await screen.findByRole('navigation', { name: /secciones/i });
    fireEvent.click(within(navigation).getByRole('button', { name: 'Registrar pago' }));

    expect(await screen.findByRole('heading', { name: 'Registrar pago', level: 1 })).toBeVisible();
    fireEvent.change(screen.getByLabelText(/cuenta del cliente/i), { target: { value: 'account-1' } });
    await waitFor(() => expect(api.getPaymentQuote).toHaveBeenCalledWith('account-1', 'store-1', expect.any(String)));
    expect(await screen.findByText('S/ 51.20')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /registrar pago completo/i }));
    await waitFor(() => expect(api.createPayment).toHaveBeenCalledWith('account-1', expect.objectContaining({
      storeId: 'store-1',
      currency: 'PEN',
      amount: '51.20',
      idempotencyKey: expect.any(String),
    })));
    await waitFor(() => expect(api.getReceipt).toHaveBeenCalledWith('payment-1', 'store-1'));
    expect(await screen.findByText('RC-000001')).toBeVisible();
    expect(screen.getByText(/pago registrado correctamente/i)).toBeVisible();
    expect(screen.getByText('obligation-3')).toBeVisible();
    expect(screen.getByText('obligation-4')).toBeVisible();
    expect(api.listAccounts).toHaveBeenCalledTimes(2);
  });

  it('shows issued cut reports and refreshes them from the API', async () => {
    const api = makeApi({ id: 'admin-1', displayName: 'Admin Negocio', platformRole: 'USER', storeAccesses: [{ storeId: 'store-1', storeName: 'Bodega Demo', currency: 'PEN', role: 'STORE_ADMIN' }] });
    render(<App api={api as never} />);
    await login();
    const navigation = await screen.findByRole('navigation', { name: /secciones/i });
    fireEvent.click(within(navigation).getByRole('button', { name: 'Reporte de corte' }));

    expect(await screen.findByRole('heading', { name: 'Reporte de corte', level: 1 })).toBeVisible();
    fireEvent.change(screen.getByLabelText(/cuenta del cliente/i), { target: { value: 'account-1' } });
    await waitFor(() => expect(api.getStatements).toHaveBeenCalledWith('account-1', 'store-1'));
    const report = await screen.findByRole('table', { name: /estados de cuenta emitidos/i });
    expect(within(report).getAllByRole('cell')[0]).toHaveTextContent('20/10/2026');
    expect(within(report).getByText('21/09/2026 – 20/10/2026')).toBeVisible();
    expect(within(report).getByText('S/ 255.80')).toBeVisible();
    expect(within(report).getByText('S/ 9007199254740993.01')).toBeVisible();

    api.getStatements.mockRejectedValueOnce(new Error('No se pudo actualizar.'));
    fireEvent.click(screen.getByRole('button', { name: /actualizar estados/i }));
    await waitFor(() => expect(api.getStatements).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('No se pudo actualizar.')).toBeVisible();
    expect(within(screen.getByRole('table', { name: /estados de cuenta emitidos/i })).getByText('S/ 255.80')).toBeVisible();
  });

  it('ignores a late cut report response after switching accounts', async () => {
    let finishFirst: ((value: unknown[]) => void) | undefined;
    const api = makeApi({ id: 'admin-1', displayName: 'Admin Negocio', platformRole: 'USER', storeAccesses: [{ storeId: 'store-1', storeName: 'Bodega Demo', currency: 'PEN', role: 'STORE_ADMIN' }] });
    const accounts = await api.listAccounts();
    api.listAccounts.mockResolvedValue([...accounts, { ...accounts[0], id: 'account-2', accountNumber: 'CC-002', customerName: 'Ana Torres' }]);
    api.getStatements.mockImplementation((accountId: string) => accountId === 'account-1'
      ? new Promise((resolve) => { finishFirst = resolve; })
      : Promise.resolve([{ id: 'cut-2', cutAt: '2026-11-01T04:59:59.000Z', periodStart: '2026-10-01', periodEnd: '2026-10-31', dueDate: '2026-11-08', currency: 'PEN', totalDue: '44.00' }]));
    render(<App api={api as never} />);
    await login();
    fireEvent.click(within(await screen.findByRole('navigation', { name: /secciones/i })).getByRole('button', { name: 'Reporte de corte' }));
    const selector = screen.getByLabelText(/cuenta del cliente/i);
    fireEvent.change(selector, { target: { value: 'account-1' } });
    await waitFor(() => expect(api.getStatements).toHaveBeenCalledWith('account-1', 'store-1'));
    fireEvent.change(selector, { target: { value: 'account-2' } });
    expect(await screen.findAllByText('S/ 44.00')).toHaveLength(2);
    finishFirst?.([{ id: 'old-cut', cutAt: '2026-10-01T04:59:59.000Z', periodStart: '2026-09-01', periodEnd: '2026-09-30', dueDate: '2026-10-08', currency: 'PEN', totalDue: '99.00' }]);
    await waitFor(() => expect(screen.queryByText('S/ 99.00')).not.toBeInTheDocument());
    expect(screen.getAllByText('S/ 44.00')).toHaveLength(2);
  });

  it('does not submit a purchase command twice while the first request is pending', async () => {
    let finishPurchase: ((value: { id: string; total: string }) => void) | undefined;
    const api = makeApi({ id: 'operator-1', displayName: 'Operador', platformRole: 'USER', storeAccesses: [{ storeId: 'store-1', storeName: 'Bodega Demo', currency: 'PEN', role: 'OPERATOR' }] });
    api.createPurchase.mockImplementation(
      () => new Promise((resolve) => { finishPurchase = resolve; }),
    );
    render(<App api={api as never} />);
    await login();
    const navigation = await screen.findByRole('navigation', { name: /secciones/i });
    fireEvent.click(within(navigation).getByRole('button', { name: 'Registrar compra' }));
    await screen.findByRole('option', { name: /CC-001/i });
    fireEvent.change(screen.getByLabelText(/^cuenta$/i), { target: { value: 'account-1' } });
    fireEvent.change(screen.getByLabelText(/producto o servicio/i), { target: { value: 'product-1' } });
    fireEvent.click(screen.getByRole('button', { name: /agregar al detalle/i }));
    const form = screen.getByRole('form', { name: /registro de compra/i });
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
