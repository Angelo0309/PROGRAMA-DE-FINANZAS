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

export const commercialInstantInLima = (instant: string) => commercialDate(limaDate(instant));