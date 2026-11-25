import { DateTime } from 'luxon';

export type ObligationStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'VOIDED';

export function effectiveObligationStatus(
  status: ObligationStatus,
  dueDate: Date,
  now = new Date(),
): ObligationStatus {
  if (status !== 'PENDING') return status;
  const todayInLima = DateTime.fromJSDate(now).setZone('America/Lima').toISODate();
  const dueOn = dueDate.toISOString().slice(0, 10);
  return todayInLima && dueOn < todayInLima ? 'OVERDUE' : status;
}
