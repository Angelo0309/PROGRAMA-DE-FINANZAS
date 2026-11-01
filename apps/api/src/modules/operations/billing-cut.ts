import { DateTime } from 'luxon';

const ZONE = 'America/Lima';

function cutInMonth(month: DateTime, billingDay: number): DateTime {
  if (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) {
    throw new RangeError('El día de corte debe estar entre 1 y 31.');
  }
  const day = Math.min(billingDay, month.daysInMonth ?? billingDay);
  return month.startOf('month').set({ day, hour: 23, minute: 59, second: 59, millisecond: 0 });
}

export function billingCutForDueDate(
  dueDate: string,
  billingDay: number,
): string {
  const due = DateTime.fromISO(dueDate, { zone: ZONE }).startOf('day');
  if (!due.isValid) throw new RangeError('Fecha de vencimiento inválida.');
  let cut = cutInMonth(due, billingDay);
  if (cut >= due) cut = cutInMonth(due.minus({ months: 1 }), billingDay);
  return cut.toFormat("yyyy-MM-dd'T'HH:mm:ssZZ");
}
