import { useState } from 'react';

import type { AccountView, ClientPaymentView } from '../../api/client';
import { commercialInstantInLima, limaDate, officialMoney } from './paymentFormat';

const ALL_ACCOUNTS = '';

export function PaymentHistory({ payments, accounts }: { payments: ClientPaymentView[]; accounts: AccountView[] }) {
  const [receiptQuery, setReceiptQuery] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState(ALL_ACCOUNTS);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const accountLabel = (accountId: string) => {
    const account = accounts.find((item) => item.id === accountId);
    if (!account) return `Cuenta ${accountId.slice(0, 8).toUpperCase()}`;
    return `${account.storeName ? `${account.storeName} · ` : ''}Cuenta ${account.accountNumber}`;
  };

  // Cuentas conocidas y, si algún pago apunta a una cuenta no listada, también esa.
  const accountIds = [...new Set([...accounts.map((account) => account.id), ...payments.map((payment) => payment.accountId)])];

  const normalizedQuery = receiptQuery.trim().toLowerCase();
  const visiblePayments = payments.filter((payment) => {
    // Se compara la fecha comercial de Lima (AAAA-MM-DD), igual que la que se muestra en la tabla.
    const paidDate = limaDate(payment.paidAt);
    return (
      (selectedAccountId === ALL_ACCOUNTS || payment.accountId === selectedAccountId) &&
      (!normalizedQuery || payment.receiptNumber.toLowerCase().includes(normalizedQuery)) &&
      (!dateFrom || paidDate >= dateFrom) &&
      (!dateTo || paidDate <= dateTo)
    );
  });

  return (
    <section className="paper-section">
      <p className="folio">HISTORIAL DE PAGOS</p>
      <h2>Comprobantes registrados</h2>
      {payments.length === 0 ? (
        <p className="empty-state">No hay pagos registrados.</p>
      ) : (
        <>
          <label>
            Cuenta
            <select value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)}>
              <option value={ALL_ACCOUNTS}>Todas las cuentas</option>
              {accountIds.map((accountId) => (
                <option key={accountId} value={accountId}>
                  {accountLabel(accountId)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Número de comprobante
            <input
              type="search"
              value={receiptQuery}
              onChange={(event) => setReceiptQuery(event.target.value)}
              placeholder="Ej. REC-001"
            />
          </label>
          <label>
            Desde
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <div className="table-wrapper">
            <table aria-label="Mi historial de pagos">
              <thead>
                <tr>
                  <th>Comprobante</th>
                  <th>Fecha</th>
                  <th>Cuenta</th>
                  <th>Método</th>
                  <th>Importe</th>
                  <th>Distribución</th>
                </tr>
              </thead>
              <tbody>
                {visiblePayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.receiptNumber}</td>
                    <td>{commercialInstantInLima(payment.paidAt)}</td>
                    <td>{accountLabel(payment.accountId)}</td>
                    <td>{payment.method.replaceAll('_', ' ')}</td>
                    <td className="money-cell">{officialMoney(payment.currency, payment.amount)}</td>
                    <td>
                      {payment.allocations.length === 0
                        ? '—'
                        : payment.allocations.map((allocation) => (
                            <dl key={allocation.obligationId}>
                              <dt>Mora</dt>
                              <dd>{officialMoney(payment.currency, allocation.lateInterestPaid)}</dd>
                              <dt>Interés</dt>
                              <dd>{officialMoney(payment.currency, allocation.compensatoryPaid)}</dd>
                              <dt>Capital</dt>
                              <dd>{officialMoney(payment.currency, allocation.principalPaid)}</dd>
                            </dl>
                          ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}