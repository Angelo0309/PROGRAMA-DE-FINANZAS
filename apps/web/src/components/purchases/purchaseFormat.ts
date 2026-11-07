const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

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

export const purchaseMonth = (purchasedAt: string) => limaDate(purchasedAt).slice(0, 7);

export const monthLabel = (yearMonth: string) => {
  const [year, month] = yearMonth.split('-');
  return `${MONTH_NAMES[Number(month) - 1] ?? month} ${year}`;
};

export const purchaseCode = (purchaseId: string) => purchaseId.slice(0, 8).toUpperCase();

/** Muestra la cantidad recibida sin ceros decimales sobrantes (1.0000 → 1). No altera importes. */
export const displayQuantity = (quantity: string) =>
  quantity.includes('.') ? quantity.replace(/\.?0+$/, '') : quantity;

export const normalizeText = (text: string) =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export const plural = (count: number, singular: string, pluralForm: string) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

export const obligationStatus = (status: string) => ({
  PAID: { label: 'Pagada', tone: 'ready' },
  OVERDUE: { label: 'Vencida', tone: 'overdue' },
  VOIDED: { label: 'Anulada', tone: 'voided' },
  PENDING: { label: 'Pendiente', tone: 'pending' },
}[status] ?? { label: status, tone: 'pending' });
