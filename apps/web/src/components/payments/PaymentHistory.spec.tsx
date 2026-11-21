import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AccountView, ClientPaymentView } from '../../api/client';
import { PaymentHistory } from './PaymentHistory';

const accounts: AccountView[] = [
  { id: 'account-1', accountNumber: 'CC-000001', storeName: 'Bodega Demo', creditLimit: '3000.00', originalOutstanding: '300.00', currency: 'PEN' },
];

const payments: ClientPaymentView[] = [
  {
    id: 'payment-1',
    accountId: 'account-1',
    receiptNumber: 'REC-001',
    paidAt: '2026-11-01T15:30:00.000Z',
    currency: 'PEN',
    amount: '100.00',
    method: 'BANK_TRANSFER',
    allocations: [],
  },
];

afterEach(cleanup);

describe('PaymentHistory', () => {
  it('muestra comprobante, fecha, cuenta, metodo e importe oficial de cada pago', () => {
    render(<PaymentHistory payments={payments} accounts={accounts} />);
    const table = within(screen.getByRole('table', { name: /historial de pagos/i }));

    expect(table.getByText('REC-001')).toBeTruthy();
    expect(table.getByText('01/11/2026')).toBeTruthy();
    expect(table.getByText(/Cuenta CC-000001/)).toBeTruthy();
    expect(table.getByText('BANK TRANSFER')).toBeTruthy();
    expect(table.getByText('S/ 100.00')).toBeTruthy();
  });
    it('filtra por numero de comprobante', () => {
    const twoPayments: ClientPaymentView[] = [
      ...payments,
      { ...payments[0], id: 'payment-2', receiptNumber: 'REC-002' },
    ];
    render(<PaymentHistory payments={twoPayments} accounts={accounts} />);

    fireEvent.change(screen.getByLabelText(/número de comprobante/i), { target: { value: 'REC-002' } });

    const table = within(screen.getByRole('table', { name: /historial de pagos/i }));
    expect(table.getByText('REC-002')).toBeTruthy();
    expect(table.queryByText('REC-001')).toBeNull();
  });
    it('filtra por cuenta', () => {
    const twoAccounts: AccountView[] = [
      ...accounts,
      { id: 'account-2', accountNumber: 'CC-000002', storeName: 'Bodega Demo', creditLimit: '1000.00', originalOutstanding: '50.00', currency: 'PEN' },
    ];
    const paymentsOfTwoAccounts: ClientPaymentView[] = [
      payments[0],
      { ...payments[0], id: 'payment-2', accountId: 'account-2', receiptNumber: 'REC-002' },
    ];
    render(<PaymentHistory payments={paymentsOfTwoAccounts} accounts={twoAccounts} />);

    fireEvent.change(screen.getByLabelText('Cuenta'), { target: { value: 'account-2' } });

    const table = within(screen.getByRole('table', { name: /historial de pagos/i }));
    expect(table.getByText('REC-002')).toBeTruthy();
    expect(table.queryByText('REC-001')).toBeNull();
  });
    it('filtra por rango de fechas', () => {
    const paymentsOfTwoDates: ClientPaymentView[] = [
      payments[0],
      { ...payments[0], id: 'payment-2', receiptNumber: 'REC-002', paidAt: '2026-11-10T15:30:00.000Z' },
    ];
    render(<PaymentHistory payments={paymentsOfTwoDates} accounts={accounts} />);

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-05' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-10' } });

    const table = within(screen.getByRole('table', { name: /historial de pagos/i }));
    expect(table.getByText('REC-002')).toBeTruthy();
    expect(table.queryByText('REC-001')).toBeNull();
  });
    it('muestra la distribucion oficial de mora, interes y capital recibida de la API', () => {
    const paymentWithAllocations: ClientPaymentView[] = [
      {
        ...payments[0],
        allocations: [
          { obligationId: 'obligation-1', lateInterestPaid: '1.50', compensatoryPaid: '3.50', principalPaid: '95.00' },
        ],
      },
    ];
    render(<PaymentHistory payments={paymentWithAllocations} accounts={accounts} />);

    const table = within(screen.getByRole('table', { name: /historial de pagos/i }));
    expect(table.getByText('Mora')).toBeTruthy();
    expect(table.getByText('S/ 1.50')).toBeTruthy();
    expect(table.getByText('Interés')).toBeTruthy();
    expect(table.getByText('S/ 3.50')).toBeTruthy();
    expect(table.getByText('Capital')).toBeTruthy();
    expect(table.getByText('S/ 95.00')).toBeTruthy();
  });
});