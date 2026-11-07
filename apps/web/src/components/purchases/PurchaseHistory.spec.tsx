import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { PurchaseView, ScheduleItemView } from '../../api/client';
import { PurchaseHistory } from './PurchaseHistory';

const octoberPurchaseId = 'aaaaaaaa-1111-4111-8111-111111111111';
const augustPurchaseId = 'bbbbbbbb-2222-4222-8222-222222222222';

// Orden recibido desde la API: compras más recientes primero.
const purchases: PurchaseView[] = [
  {
    id: octoberPurchaseId,
    purchasedAt: '2026-10-20T15:00:00.000Z',
    total: '189.90',
    currency: 'PEN',
    items: [
      { productId: 'product-1', description: 'Cafetera compacta', quantity: '1.0000', unitPrice: '179.9000', lineTotal: '179.90', imageUrl: 'https://images.example.com/cafetera.jpg' },
      { productId: 'product-2', description: 'Filtro de papel', quantity: '2.0000', unitPrice: '5.0000', lineTotal: '10.00', imageUrl: null },
    ],
  },
  {
    // 01/09/2026 03:00 UTC corresponde al 31/08/2026 en Lima.
    id: augustPurchaseId,
    purchasedAt: '2026-09-01T03:00:00.000Z',
    total: '320.00',
    currency: 'PEN',
    items: [
      { productId: 'product-3', description: 'Licuadora de vidrio', quantity: '1.0000', unitPrice: '320.0000', lineTotal: '320.00', imageUrl: null },
    ],
  },
];

const schedule: ScheduleItemView[] = [
  { id: 'obligation-1', purchaseId: octoberPurchaseId, purchasedAt: '2026-10-20T15:00:00.000Z', installmentNumber: 1, dueDate: '2026-11-28', openingBalance: '189.90', principalDue: '92.00', compensatoryInterest: '8.00', lateInterest: '0.00', amountDue: '100.00', paidAmount: '100.00', currency: 'PEN', status: 'PAID' },
  { id: 'obligation-2', purchaseId: octoberPurchaseId, purchasedAt: '2026-10-20T15:00:00.000Z', installmentNumber: 2, dueDate: '2026-12-28', openingBalance: '97.90', principalDue: '93.00', compensatoryInterest: '2.00', lateInterest: '0.00', amountDue: '95.00', paidAmount: '0.00', currency: 'PEN', status: 'PENDING' },
];

const detail = () => within(screen.getByRole('article', { name: /compra/i }));
const purchaseList = () => within(screen.getByRole('list', { name: 'Lista de compras' }));

describe('PurchaseHistory', () => {
  afterEach(cleanup);

  it('selects the most recent purchase and shows its products and associated plan', () => {
    render(<PurchaseHistory purchases={purchases} schedule={schedule} />);

    const buttons = purchaseList().getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('2 de 2 compras')).toBeVisible();

    expect(detail().getByRole('heading', { name: 'Compra AAAAAAAA' })).toBeVisible();
    expect(detail().getByText('Registrada el 20/10/2026')).toBeVisible();
    expect(detail().getByLabelText('Total de la compra')).toHaveTextContent('S/ 189.90');

    const products = within(screen.getByRole('table', { name: 'Productos de la compra' }));
    expect(products.getByRole('img', { name: 'Cafetera compacta' })).toBeVisible();
    expect(products.getByText('Filtro de papel')).toBeVisible();
    expect(products.getByText('S/ 179.90')).toBeVisible();
    expect(products.getByText('2')).toBeVisible();
    expect(products.getByText('Sin imagen')).toBeVisible();

    expect(detail().getByText('2 obligaciones · 1 pagada · Próximo vencimiento: 28/12/2026')).toBeVisible();
    const installments = within(screen.getByRole('table', { name: 'Cuotas de la compra' }));
    expect(installments.getByText('Pagada')).toBeVisible();
    expect(installments.getByText('Pendiente')).toBeVisible();
  });

  it('shows the detail of another purchase when it is selected', () => {
    render(<PurchaseHistory purchases={purchases} schedule={schedule} />);

    fireEvent.click(purchaseList().getByRole('button', { name: /BBBBBBBB/ }));

    expect(purchaseList().getByRole('button', { name: /BBBBBBBB/ })).toHaveAttribute('aria-pressed', 'true');
    expect(detail().getByRole('heading', { name: 'Compra BBBBBBBB' })).toBeVisible();
    expect(detail().getByText('Registrada el 31/08/2026')).toBeVisible();
    expect(detail().getByText('Licuadora de vidrio')).toBeVisible();
    expect(detail().queryByText('Cafetera compacta')).not.toBeInTheDocument();
    expect(detail().getByText('Esta compra no tiene obligaciones registradas.')).toBeVisible();
  });

  it('filters the history by purchase month using the Lima commercial date', () => {
    render(<PurchaseHistory purchases={purchases} schedule={schedule} />);
    const monthSelector = screen.getByRole('combobox', { name: 'Mes de compra' });

    const options = within(monthSelector).getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(['Todos los meses', 'Octubre 2026', 'Agosto 2026']);

    fireEvent.change(monthSelector, { target: { value: '2026-08' } });
    expect(purchaseList().getAllByRole('button')).toHaveLength(1);
    expect(screen.getByText('1 de 2 compras')).toBeVisible();
    expect(detail().getByRole('heading', { name: 'Compra BBBBBBBB' })).toBeVisible();
  });

  it('searches purchases by product name ignoring accents and capitalization', () => {
    render(<PurchaseHistory purchases={purchases} schedule={schedule} />);
    const search = screen.getByRole('searchbox', { name: 'Buscar producto' });

    fireEvent.change(search, { target: { value: 'LICUADORÁ' } });
    expect(purchaseList().getAllByRole('button')).toHaveLength(1);
    expect(detail().getByText('Licuadora de vidrio')).toBeVisible();

    fireEvent.change(search, { target: { value: 'televisor' } });
    expect(screen.queryByRole('list', { name: 'Lista de compras' })).not.toBeInTheDocument();
    expect(screen.getByText('No hay compras que coincidan con los filtros.')).toBeVisible();
    expect(screen.getByText('0 de 2 compras')).toBeVisible();
  });

  it('shows the empty state when the client has no purchases', () => {
    render(<PurchaseHistory purchases={[]} schedule={[]} />);

    expect(screen.getByText('No hay compras recientes.')).toBeVisible();
    expect(screen.queryByRole('combobox', { name: 'Mes de compra' })).not.toBeInTheDocument();
  });
});
