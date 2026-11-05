import { Decimal } from 'decimal.js';
import { DateTime } from 'luxon';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type LocalDate = string;
export type RateKind = 'EFFECTIVE' | 'NOMINAL';

export interface RateInput {
  rate: Decimal.Value;
  kind: RateKind;
  baseDays: 1 | 30 | 360;
  capitalizationDays?: number;
}

export interface CycleInput {
  purchasedAt: string;
  cutDay: number;
  cutTime: string;
  paymentDay: number;
  zone: string;
}

export interface CycleDates {
  assignedCutAt: string;
  basePaymentDate: LocalDate;
  firstInstallmentDate: LocalDate;
}

export interface EndOfMonthInput {
  principal: Decimal.Value;
  purchaseDate: LocalDate;
  paymentDate: LocalDate;
  dailyRate: Decimal;
}

export interface ObligationResult {
  days: number;
  interest: Decimal;
  amount: Decimal;
}

export interface FrenchScheduleInput {
  principal: Decimal.Value;
  purchaseDate: LocalDate;
  baseDate: LocalDate;
  numberOfInstallments: number;
  paymentDay: number;
  dailyRate: Decimal;
}

export interface Installment {
  number: number;
  dueDate: LocalDate;
  openingBalance: Decimal;
  interest: Decimal;
  amortization: Decimal;
  payment: Decimal;
  closingBalance: Decimal;
  originalPrincipalRecoverable: Decimal;
}

export interface FrenchSchedule {
  graceDays: number;
  capitalAfterGrace: Decimal;
  monthlyRate: Decimal;
  theoreticalPayment: Decimal;
  installments: Installment[];
}

export interface DueObligation {
  id: string;
  dueDate: LocalDate;
  baseAmount: Decimal.Value;
  compensatoryInterest: Decimal.Value;
  originalPrincipal: Decimal.Value;
  lateDailyRate: Decimal;
}

export interface AmountDueInput {
  paidAt: LocalDate;
  obligations: DueObligation[];
}

export interface AmountDueLine {
  id: string;
  dueDate: LocalDate;
  lateDays: number;
  lateInterest: Decimal;
  compensatoryInterest: Decimal;
  originalPrincipal: Decimal;
  exactTotal: Decimal;
}

export interface AmountDueResult {
  lines: AmountDueLine[];
  exactTotal: Decimal;
  moneyTotal: string;
  roundingAdjustment: string;
}

function parseLocalDate(value: LocalDate): DateTime {
  const parsed = DateTime.fromISO(value, { zone: 'utc' });
  if (!parsed.isValid || parsed.toISODate() !== value) {
    throw new RangeError(`Fecha local invalida: ${value}`);
  }
  return parsed;
}

function normalizedCommercialDay(date: DateTime): number {
  if (date.day === 31 || (date.month === 2 && date.day === date.daysInMonth)) {
    return 30;
  }
  return date.day;
}

function assertDay(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 30) {
    throw new RangeError(`${label} debe estar entre 1 y 30`);
  }
}

function dateWithClampedDay(base: DateTime, requestedDay: number): DateTime {
  assertDay(requestedDay, 'El dia configurado');
  return base.startOf('month').set({ day: Math.min(requestedDay, base.daysInMonth ?? 30) });
}

function nextConfiguredDate(base: DateTime, requestedDay: number): DateTime {
  const nextMonth = base.plus({ months: 1 });
  return dateWithClampedDay(nextMonth, requestedDay);
}

function money(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function commercialDays30_360(start: LocalDate, end: LocalDate): number {
  const startDate = parseLocalDate(start);
  const endDate = parseLocalDate(end);
  if (endDate < startDate) {
    throw new RangeError('La fecha final no puede ser anterior a la inicial');
  }

  return (
    360 * (endDate.year - startDate.year) +
    30 * (endDate.month - startDate.month) +
    normalizedCommercialDay(endDate) -
    normalizedCommercialDay(startDate)
  );
}

export function toEffectiveDailyRate(input: RateInput): Decimal {
  const rate = new Decimal(input.rate);
  if (rate.isNegative()) {
    throw new RangeError('La tasa no puede ser negativa');
  }

  if (input.kind === 'EFFECTIVE') {
    return rate.plus(1).pow(new Decimal(1).div(input.baseDays)).minus(1);
  }

  const capitalizationDays = input.capitalizationDays;
  if (
    capitalizationDays === undefined ||
    !Number.isInteger(capitalizationDays) ||
    capitalizationDays < 1 ||
    capitalizationDays > input.baseDays ||
    input.baseDays % capitalizationDays !== 0
  ) {
    throw new RangeError('La capitalizacion nominal debe ser compatible con su periodo base');
  }

  const periodicRate = rate.mul(capitalizationDays).div(input.baseDays);
  return periodicRate.plus(1).pow(new Decimal(1).div(capitalizationDays)).minus(1);
}

export function assignBillingCycle(input: CycleInput): CycleDates {
  assertDay(input.cutDay, 'El dia de corte');
  assertDay(input.paymentDay, 'El dia de pago');

  const purchase = DateTime.fromISO(input.purchasedAt, { setZone: true }).setZone(input.zone);
  const time = DateTime.fromFormat(input.cutTime, 'HH:mm:ss', { zone: input.zone });
  if (!purchase.isValid || !time.isValid) {
    throw new RangeError('La fecha de compra o la hora de corte es invalida');
  }

  const currentCutDate = dateWithClampedDay(purchase, input.cutDay);
  const currentCut = currentCutDate.set({
    hour: time.hour,
    minute: time.minute,
    second: time.second,
    millisecond: 0,
  });
  const assignedCut = purchase.toMillis() <= currentCut.toMillis()
    ? currentCut
    : dateWithClampedDay(purchase.plus({ months: 1 }), input.cutDay).set({
        hour: time.hour,
        minute: time.minute,
        second: time.second,
        millisecond: 0,
      });

  let basePayment = dateWithClampedDay(assignedCut, input.paymentDay);
  if (basePayment.startOf('day') <= assignedCut.startOf('day')) {
    basePayment = nextConfiguredDate(assignedCut, input.paymentDay);
  }
  const firstInstallment = nextConfiguredDate(basePayment, input.paymentDay);

  return {
    assignedCutAt: assignedCut.toFormat("yyyy-MM-dd'T'HH:mm:ssZZ"),
    basePaymentDate: basePayment.toISODate()!,
    firstInstallmentDate: firstInstallment.toISODate()!,
  };
}

export function calculateEndOfMonthObligation(input: EndOfMonthInput): ObligationResult {
  const principal = new Decimal(input.principal);
  if (!principal.isPositive()) {
    throw new RangeError('El capital debe ser positivo');
  }
  const days = commercialDays30_360(input.purchaseDate, input.paymentDate);
  const amount = principal.mul(input.dailyRate.plus(1).pow(days));
  return {
    days,
    interest: amount.minus(principal),
    amount,
  };
}

export function buildFrenchSchedule(input: FrenchScheduleInput): FrenchSchedule {
  const principal = new Decimal(input.principal);
  if (!principal.isPositive()) {
    throw new RangeError('El capital debe ser positivo');
  }
  if (!Number.isInteger(input.numberOfInstallments) || input.numberOfInstallments < 1) {
    throw new RangeError('El numero de cuotas debe ser positivo');
  }
  assertDay(input.paymentDay, 'El dia de pago');

  const graceDays = commercialDays30_360(input.purchaseDate, input.baseDate);
  const capitalAfterGrace = principal.mul(input.dailyRate.plus(1).pow(graceDays));
  const monthlyRate = input.dailyRate.plus(1).pow(30).minus(1);
  const theoreticalPayment = monthlyRate.isZero()
    ? capitalAfterGrace.div(input.numberOfInstallments)
    : capitalAfterGrace
        .mul(monthlyRate)
        .div(new Decimal(1).minus(monthlyRate.plus(1).pow(-input.numberOfInstallments)));

  const baseDate = parseLocalDate(input.baseDate);
  const installments: Installment[] = [];
  let balance = capitalAfterGrace;
  let recoveredOriginal = new Decimal(0);

  for (let index = 1; index <= input.numberOfInstallments; index += 1) {
    const openingBalance = balance;
    const interest = openingBalance.mul(monthlyRate);
    const isLast = index === input.numberOfInstallments;
    const amortization = isLast ? openingBalance : theoreticalPayment.minus(interest);
    const payment = amortization.plus(interest);
    const closingBalance = isLast ? new Decimal(0) : openingBalance.minus(amortization);

    let originalPrincipalRecoverable = isLast
      ? principal.minus(recoveredOriginal)
      : amortization.mul(principal).div(capitalAfterGrace);
    if (originalPrincipalRecoverable.isNegative()) {
      originalPrincipalRecoverable = new Decimal(0);
    }
    recoveredOriginal = recoveredOriginal.plus(originalPrincipalRecoverable);

    const dueDate = dateWithClampedDay(baseDate.plus({ months: index }), input.paymentDay);
    installments.push({
      number: index,
      dueDate: dueDate.toISODate()!,
      openingBalance,
      interest,
      amortization,
      payment,
      closingBalance,
      originalPrincipalRecoverable,
    });
    balance = closingBalance;
  }

  return {
    graceDays,
    capitalAfterGrace,
    monthlyRate,
    theoreticalPayment,
    installments,
  };
}

export function calculateAmountDue(input: AmountDueInput): AmountDueResult {
  parseLocalDate(input.paidAt);
  const lines = input.obligations
    .filter((obligation) => obligation.dueDate <= input.paidAt)
    .sort((left, right) =>
      left.dueDate === right.dueDate
        ? left.id.localeCompare(right.id)
        : left.dueDate.localeCompare(right.dueDate),
    )
    .map<AmountDueLine>((obligation) => {
      const baseAmount = new Decimal(obligation.baseAmount);
      const compensatoryInterest = new Decimal(obligation.compensatoryInterest);
      const originalPrincipal = new Decimal(obligation.originalPrincipal);
      const lateDays = commercialDays30_360(obligation.dueDate, input.paidAt);
      const lateInterest = baseAmount.mul(obligation.lateDailyRate.plus(1).pow(lateDays)).minus(baseAmount);
      return {
        id: obligation.id,
        dueDate: obligation.dueDate,
        lateDays,
        lateInterest,
        compensatoryInterest,
        originalPrincipal,
        exactTotal: baseAmount.plus(lateInterest),
      };
    });

  const exactTotal = lines.reduce((total, line) => total.plus(line.exactTotal), new Decimal(0));
  const roundedComponents = lines.reduce(
    (total, line) =>
      total
        .plus(money(line.lateInterest))
        .plus(money(line.compensatoryInterest))
        .plus(money(line.originalPrincipal)),
    new Decimal(0),
  );
  const roundedTotal = money(exactTotal);

  return {
    lines,
    exactTotal,
    moneyTotal: roundedTotal.toFixed(2),
    roundingAdjustment: roundedTotal.minus(roundedComponents).toFixed(2),
  };
}
