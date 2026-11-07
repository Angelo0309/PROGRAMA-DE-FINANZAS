export const officialMoney = (currency: string, amount: string) =>
  `${currency === 'PEN' ? 'S/' : currency} ${amount}`;

export const commercialDate = (date: string) => {
  const [year, month, day] = date.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};

export const purchasePlanLabel = (purchasedAt: string, purchaseId: string) =>
  `Compra ${commercialDate(purchasedAt)} · ${purchaseId.slice(0, 8).toUpperCase()}`;

export const obligationStatus = (status: string) => ({
  PAID: { label: 'Pagada', tone: 'ready' },
  OVERDUE: { label: 'Vencida', tone: 'overdue' },
  VOIDED: { label: 'Anulada', tone: 'voided' },
  PENDING: { label: 'Pendiente', tone: 'pending' },
}[status] ?? { label: status, tone: 'pending' });
