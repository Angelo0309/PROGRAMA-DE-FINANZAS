import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { AccountView, ScheduleItemView } from '../../api/client';
import { ClientPaymentPlans } from './ClientPaymentPlans';

const firstPurchaseId = '11111111-1111-4111-8111-111111111111';
const secondPurchaseId = '22222222-2222-4222-8222-222222222222';
const otherAccountPurchaseId = '33333333-3333-4333-8333-333333333333';

type ClientScheduleItem = ScheduleItemView & { accountId?: string };

const accounts: AccountView[] = [
  { id: 'account-1', accountNumber: 'CC-000001', storeName: 'Bodega Demo', creditLimit: '3000.00', originalOutstanding: '300.00', currency: 'PEN' },
  { id: 'account-2', accountNumber: 'CC-DEMO-PAGO', storeName: 'Bodega Demo', creditLimit: '1000.00', originalOutstanding: '50.00', currency: 'PEN' },
];

function obligation(overrides: Partial<ClientScheduleItem>): ClientScheduleItem {
  return {
    id: 'obligation',
    accountId: 'account-1',
    purchaseId: firstPurchaseId,
    purchasedAt: '2026-10-20T15:00:00.000Z',
    installmentNumber: 1,
    dueDate: '2026-11-28',
    openingBalance: '200.00',
    principalDue: '95.00',
    compensatoryInterest: '5.00',
    lateInterest: '0.00',
    amountDue: '100.00',
    paidAmount: '0.00',
    currency: 'PEN',
    status: 'PENDING',
    ...overrides,
  };
}

// Orden recibido desde GET /me/schedule: por fecha de vencimiento.
const singleAccountSchedule: ClientScheduleItem[] = [
  obligation({ id: 'second-plan-row', purchaseId: secondPurchaseId, purchasedAt: '2026-09-05T15:00:00.000Z', dueDate: '2026-10-28', amountDue: '51.00', paidAmount: '51.00', status: 'PAID' }),
  obligation({ id: 'first-plan-row-1', installmentNumber: 1, dueDate: '2026-11-28', amountDue: '100.00', status: 'OVERDUE' }),
  obligation({ id: 'first-plan-row-2', installmentNumber: 2, dueDate: '2026-12-28', amountDue: '105.00', status: 'PENDING' }),
];

const twoAccountSchedule: ClientScheduleItem[] = [
  ...singleAccountSchedule,
  obligation({ id: 'other-account-row', accountId: 'account-2', purchaseId: otherAccountPurchaseId, purchasedAt: '2026-10-01T15:00:00.000Z', dueDate: '2026-11-03', amountDue: '50.00', status: 'OVERDUE' }),
];

function metric(label: string) {
  const article = within(screen.getByLabelText('Resumen de mi plan de pagos')).getByText(label).closest('article');
  if (!article) throw new Error(`No se encontró la métrica ${label}`);
  return within(article);
}

const planTable = () => within(screen.getByRole('table', { name: /mi plan de pagos/i }));
const optionNames = (select: HTMLElement) => within(select).getAllByRole('option').map((option) => option.textContent);

describe('ClientPaymentPlans', () => {
  afterEach(cleanup);

  it('shows every plan of the account by default with an identifying Plan column', () => {
    render(<ClientPaymentPlans schedule={singleAccountSchedule} accounts={accounts} />);

    expect(screen.queryByRole('combobox', { name: 'Cuenta' })).not.toBeInTheDocument();
    const selector = screen.getByRole('combobox', { name: 'Plan de pago' });
    expect(selector).toHaveValue('all');
    expect(optionNames(selector)).toEqual(['Todos los planes', 'Compra 20/10/2026 · 11111111', 'Compra 05/09/2026 · 22222222']);

    expect(planTable().getByRole('columnheader', { name: 'Plan' })).toBeVisible();
    expect(planTable().getAllByRole('row')).toHaveLength(4);
    expect(planTable().getAllByText('Compra 20/10/2026 · 11111111')).toHaveLength(2);
    expect(metric('Obligaciones del plan').getByText('3')).toBeVisible();
    expect(metric('Cuotas pagadas').getByText('1')).toBeVisible();
    expect(metric('Próximo vencimiento').getByText('28/11/2026')).toBeVisible();
    expect(metric('Importe del próximo vencimiento').getByText('S/ 100.00')).toBeVisible();
  });

  it('filters rows and summary by the selected purchase plan', () => {
    render(<ClientPaymentPlans schedule={singleAccountSchedule} accounts={accounts} />);
    const selector = screen.getByRole('combobox', { name: 'Plan de pago' });

    fireEvent.change(selector, { target: { value: firstPurchaseId } });
    expect(planTable().queryByRole('columnheader', { name: 'Plan' })).not.toBeInTheDocument();
    expect(planTable().getAllByRole('row')).toHaveLength(3);
    expect(planTable().queryByText('28/10/2026')).not.toBeInTheDocument();
    expect(screen.getByText('Compra 20/10/2026 · 11111111', { selector: '.schedule-plan-title' })).toBeVisible();
    expect(metric('Obligaciones del plan').getByText('2')).toBeVisible();
    expect(metric('Cuotas pagadas').getByText('0')).toBeVisible();
    expect(metric('Próximo vencimiento').getByText('28/11/2026')).toBeVisible();

    fireEvent.change(selector, { target: { value: secondPurchaseId } });
    expect(planTable().getAllByRole('row')).toHaveLength(2);
    expect(metric('Obligaciones del plan').getByText('1')).toBeVisible();
    expect(metric('Cuotas pagadas').getByText('1')).toBeVisible();
    expect(metric('Próximo vencimiento').getByText('Sin pendientes')).toBeVisible();
    expect(metric('Importe del próximo vencimiento').getByText('—')).toBeVisible();

    fireEvent.change(selector, { target: { value: 'all' } });
    expect(planTable().getAllByRole('row')).toHaveLength(4);
  });

  it('never mixes plans from different accounts of the same client', () => {
    render(<ClientPaymentPlans schedule={twoAccountSchedule} accounts={accounts} />);

    const accountSelector = screen.getByRole('combobox', { name: 'Cuenta' });
    expect(optionNames(accountSelector)).toEqual(['Bodega Demo · Cuenta CC-000001', 'Bodega Demo · Cuenta CC-DEMO-PAGO']);
    expect(accountSelector).toHaveValue('account-1');
    expect(optionNames(screen.getByRole('combobox', { name: 'Plan de pago' }))).not.toContain('Compra 01/10/2026 · 33333333');
    expect(planTable().queryByText('03/11/2026')).not.toBeInTheDocument();
    expect(metric('Obligaciones del plan').getByText('3')).toBeVisible();

    fireEvent.change(screen.getByRole('combobox', { name: 'Plan de pago' }), { target: { value: firstPurchaseId } });
    fireEvent.change(accountSelector, { target: { value: 'account-2' } });

    const planSelector = screen.getByRole('combobox', { name: 'Plan de pago' });
    expect(planSelector).toHaveValue('all');
    expect(optionNames(planSelector)).toEqual(['Todos los planes', 'Compra 01/10/2026 · 33333333']);
    expect(planTable().getAllByRole('row')).toHaveLength(2);
    expect(metric('Obligaciones del plan').getByText('1')).toBeVisible();
    expect(metric('Próximo vencimiento').getByText('03/11/2026')).toBeVisible();
    expect(metric('Importe del próximo vencimiento').getByText('S/ 50.00')).toBeVisible();
  });

  it('keeps purchases made on the same day distinguishable by their short code', () => {
    render(<ClientPaymentPlans schedule={[
      obligation({ id: 'row-a', purchaseId: firstPurchaseId }),
      obligation({ id: 'row-b', purchaseId: secondPurchaseId }),
    ]} accounts={accounts} />);

    const selector = screen.getByRole('combobox', { name: 'Plan de pago' });
    expect(within(selector).getByRole('option', { name: 'Compra 20/10/2026 · 11111111' })).toBeInTheDocument();
    expect(within(selector).getByRole('option', { name: 'Compra 20/10/2026 · 22222222' })).toBeInTheDocument();
  });

  it('still filters by plan when the schedule does not include accountId', () => {
    const withoutAccount = singleAccountSchedule.map((item) => ({ ...item, accountId: undefined }));
    render(<ClientPaymentPlans schedule={withoutAccount} accounts={accounts} />);

    expect(screen.queryByRole('combobox', { name: 'Cuenta' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Plan de pago' }), { target: { value: firstPurchaseId } });
    expect(planTable().getAllByRole('row')).toHaveLength(3);
  });

  it('shows the empty state without selectors when there are no installments', () => {
    render(<ClientPaymentPlans schedule={[]} accounts={accounts} />);

    expect(screen.getByText('No hay cuotas programadas.')).toBeVisible();
    expect(screen.queryByRole('combobox', { name: 'Plan de pago' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Cuenta' })).not.toBeInTheDocument();
  });
});
