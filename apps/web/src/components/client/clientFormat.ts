export const officialMoney = (currency: string, amount: string) =>
  `${currency === 'PEN' ? 'S/' : currency} ${amount}`;

export const commercialDate = (date: string) => {
  const [year, month, day] = date.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};

/** Fecha comercial (AAAA-MM-DD) de un instante ISO en la zona horaria de Lima. */
export function limaDate(instant: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

// purchasedAt es un instante UTC; se muestra con la fecha de Lima, igual que en Mis compras.
export const purchasePlanLabel = (purchasedAt: string, purchaseId: string) =>
  `Compra ${commercialDate(limaDate(purchasedAt))} · ${purchaseId.slice(0, 8).toUpperCase()}`;

export const obligationStatus = (status: string) => ({
  PAID: { label: 'Pagada', tone: 'ready' },
  OVERDUE: { label: 'Vencida', tone: 'overdue' },
  VOIDED: { label: 'Anulada', tone: 'voided' },
  PENDING: { label: 'Pendiente', tone: 'pending' },
}[status] ?? { label: status, tone: 'pending' });
