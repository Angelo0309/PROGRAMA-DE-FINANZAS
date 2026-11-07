import { useMemo, useState } from 'react';

import type { AccountView, ScheduleItemView } from '../../api/client';
import { commercialDate, obligationStatus, officialMoney, purchasePlanLabel } from './clientFormat';
import './client.css';

const ALL_PLANS = 'all';

// GET /me/schedule ya devuelve accountId (portal.service.ts), aunque el contrato web todavía no lo declara.
type ClientScheduleItem = ScheduleItemView & { accountId?: string };

export function ClientPaymentPlans({ schedule, accounts }: { schedule: ClientScheduleItem[]; accounts: AccountView[] }) {
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState(ALL_PLANS);

  // Cuentas que tienen cuotas, en el orden de /me/accounts; nunca se mezclan planes de cuentas distintas.
  const scheduleAccounts = useMemo(() => {
    const ids = [...new Set(schedule.flatMap((item) => (item.accountId ? [item.accountId] : [])))];
    const order = (id: string) => {
      const index = accounts.findIndex((account) => account.id === id);
      return index === -1 ? accounts.length : index;
    };
    return ids
      .sort((first, second) => order(first) - order(second))
      .map((id) => {
        const account = accounts.find((candidate) => candidate.id === id);
        const label = account
          ? `${account.storeName ? `${account.storeName} · ` : ''}Cuenta ${account.accountNumber}`
          : `Cuenta ${id.slice(0, 8).toUpperCase()}`;
        return { id, label };
      });
  }, [accounts, schedule]);

  const activeAccount = scheduleAccounts.find((account) => account.id === selectedAccountId) ?? scheduleAccounts[0];
  const accountSchedule = activeAccount
    ? schedule.filter((item) => item.accountId === activeAccount.id)
    : schedule;

  const plans = (() => {
    const uniquePlans = new Map<string, { purchaseId: string; purchasedAt: string }>();
    accountSchedule.forEach((item) => uniquePlans.set(item.purchaseId, { purchaseId: item.purchaseId, purchasedAt: item.purchasedAt }));
    return [...uniquePlans.values()].sort((first, second) =>
      second.purchasedAt.localeCompare(first.purchasedAt) || first.purchaseId.localeCompare(second.purchaseId));
  })();

  const selectedPlan = plans.find((plan) => plan.purchaseId === selectedPurchaseId);
  const showAllPlans = !selectedPlan;
  const visibleSchedule = selectedPlan
    ? accountSchedule.filter((item) => item.purchaseId === selectedPlan.purchaseId)
    : accountSchedule;
  const paidCount = visibleSchedule.filter((item) => item.status === 'PAID').length;
  const nextPending = visibleSchedule.find((item) => item.status === 'PENDING' || item.status === 'OVERDUE');

  function changeAccount(accountId: string) {
    setSelectedPurchaseId(ALL_PLANS);
    setSelectedAccountId(accountId);
  }

  return (
    <section className="paper-section client-plans">
      <p className="folio">PLAN DE PAGOS</p>
      <h2>Cuotas y vencimientos</h2>
      {schedule.length === 0 ? <p className="empty-state">No hay cuotas programadas.</p> : (
        <>
          <div className="client-plan-filters">
            {scheduleAccounts.length > 1 && (
              <div className="client-plan-filter">
                <label htmlFor="client-plan-account">Cuenta</label>
                <select id="client-plan-account" value={activeAccount?.id ?? ''} onChange={(event) => changeAccount(event.target.value)}>
                  {scheduleAccounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}
                </select>
              </div>
            )}
            <div className="client-plan-filter">
              <label htmlFor="client-plan">Plan de pago</label>
              <select id="client-plan" value={selectedPlan ? selectedPlan.purchaseId : ALL_PLANS} onChange={(event) => setSelectedPurchaseId(event.target.value)}>
                <option value={ALL_PLANS}>Todos los planes</option>
                {plans.map((plan) => <option key={plan.purchaseId} value={plan.purchaseId}>{purchasePlanLabel(plan.purchasedAt, plan.purchaseId)}</option>)}
              </select>
            </div>
          </div>
          {selectedPlan && <p className="schedule-plan-title">{purchasePlanLabel(selectedPlan.purchasedAt, selectedPlan.purchaseId)}</p>}

          <section className="metric-strip schedule-metrics" aria-label="Resumen de mi plan de pagos">
            <article><span>Obligaciones del plan</span><strong>{visibleSchedule.length}</strong></article>
            <article><span>Cuotas pagadas</span><strong>{paidCount}</strong></article>
            <article><span>Próximo vencimiento</span><strong className="store-name">{nextPending ? commercialDate(nextPending.dueDate) : 'Sin pendientes'}</strong></article>
            <article><span>Importe del próximo vencimiento</span><strong className="store-name">{nextPending ? officialMoney(nextPending.currency, nextPending.amountDue) : '—'}</strong></article>
          </section>

          <div className="table-wrapper">
            <table aria-label="Mi plan de pagos">
              <thead><tr>{showAllPlans && <th>Plan</th>}<th>Cuota</th><th>Vencimiento</th><th>Capital</th><th>Interés</th><th>Importe</th><th>Estado</th></tr></thead>
              <tbody>
                {visibleSchedule.map((item) => {
                  const status = obligationStatus(item.status);
                  return (
                    <tr key={item.id}>
                      {showAllPlans && <td>{purchasePlanLabel(item.purchasedAt, item.purchaseId)}</td>}
                      <td>{item.installmentNumber}</td>
                      <td>{commercialDate(item.dueDate)}</td>
                      <td>{officialMoney(item.currency, item.principalDue)}</td>
                      <td>{officialMoney(item.currency, item.compensatoryInterest)}</td>
                      <td className="money-cell">{officialMoney(item.currency, item.amountDue)}</td>
                      <td><span className={`status-pill ${status.tone}`}>{status.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
