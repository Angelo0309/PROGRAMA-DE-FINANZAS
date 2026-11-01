import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';

import {
  assignBillingCycle,
  buildFrenchSchedule,
  calculateAmountDue,
  calculateEndOfMonthObligation,
  commercialDays30_360,
  toEffectiveDailyRate,
} from './financial-engine.js';

describe('commercialDays30_360', () => {
  it('counts 11 commercial days from 15 to 26 September', () => {
    expect(commercialDays30_360('2026-09-15', '2026-09-26')).toBe(11);
  });

  it('normalizes the last day of February to day 30', () => {
    expect(commercialDays30_360('2028-02-29', '2028-03-30')).toBe(30);
  });
});

describe('toEffectiveDailyRate', () => {
  it('converts a 24 percent effective annual rate to its daily equivalent', () => {
    const dailyRate = toEffectiveDailyRate({
      rate: '0.24',
      kind: 'EFFECTIVE',
      baseDays: 360,
    });

    expect(dailyRate.toFixed(15)).toBe('0.000597710167622');
  });

  it('converts a 24 percent nominal annual rate capitalized daily', () => {
    const dailyRate = toEffectiveDailyRate({
      rate: '0.24',
      kind: 'NOMINAL',
      baseDays: 360,
      capitalizationDays: 1,
    });

    expect(dailyRate.toFixed(15)).toBe('0.000666666666667');
  });
});

describe('assignBillingCycle', () => {
  it('keeps a purchase made exactly at cutoff in the current cycle', () => {
    const cycle = assignBillingCycle({
      purchasedAt: '2026-09-20T23:59:59-05:00',
      cutDay: 20,
      cutTime: '23:59:59',
      paymentDay: 26,
      zone: 'America/Lima',
    });

    expect(cycle).toEqual({
      assignedCutAt: '2026-09-20T23:59:59-05:00',
      basePaymentDate: '2026-09-26',
      firstInstallmentDate: '2026-10-26',
    });
  });

  it('moves a purchase after cutoff to the following cycle', () => {
    const cycle = assignBillingCycle({
      purchasedAt: '2026-09-22T15:00:00-05:00',
      cutDay: 20,
      cutTime: '23:59:59',
      paymentDay: 26,
      zone: 'America/Lima',
    });

    expect(cycle.basePaymentDate).toBe('2026-10-26');
    expect(cycle.firstInstallmentDate).toBe('2026-11-26');
  });

  it('clamps a configured day 30 to the last real day of February', () => {
    const cycle = assignBillingCycle({
      purchasedAt: '2027-02-20T10:00:00-05:00',
      cutDay: 25,
      cutTime: '23:59:59',
      paymentDay: 30,
      zone: 'America/Lima',
    });

    expect(cycle.basePaymentDate).toBe('2027-02-28');
    expect(cycle.firstInstallmentDate).toBe('2027-03-30');
  });
});

describe('calculateEndOfMonthObligation', () => {
  it('matches the pre-cutoff 500-sol acceptance case', () => {
    const dailyRate = toEffectiveDailyRate({
      rate: '0.24',
      kind: 'EFFECTIVE',
      baseDays: 360,
    });
    const obligation = calculateEndOfMonthObligation({
      principal: '500',
      purchaseDate: '2026-09-15',
      paymentDate: '2026-09-26',
      dailyRate,
    });

    expect(obligation.days).toBe(11);
    expect(obligation.interest.toDecimalPlaces(2).toFixed(2)).toBe('3.30');
    expect(obligation.amount.toDecimalPlaces(2).toFixed(2)).toBe('503.30');
  });

  it('capitalizes a post-cutoff purchase until the next payment date', () => {
    const dailyRate = toEffectiveDailyRate({
      rate: '0.24',
      kind: 'EFFECTIVE',
      baseDays: 360,
    });

    const obligation = calculateEndOfMonthObligation({
      principal: '800',
      purchaseDate: '2026-09-22',
      paymentDate: '2026-10-26',
      dailyRate,
    });

    expect(obligation.days).toBe(34);
    expect(obligation.interest.toFixed(12)).toBe('16.419080694212');
    expect(obligation.amount.toDecimalPlaces(2).toFixed(2)).toBe('816.42');
  });
});

describe('buildFrenchSchedule', () => {
  it('capitalizes grace before producing three increasing-amortization payments', () => {
    const dailyRate = toEffectiveDailyRate({
      rate: '0.24',
      kind: 'EFFECTIVE',
      baseDays: 360,
    });

    const plan = buildFrenchSchedule({
      principal: '1200',
      purchaseDate: '2026-09-15',
      baseDate: '2026-09-26',
      numberOfInstallments: 3,
      paymentDay: 26,
      dailyRate,
    });

    expect(plan.graceDays).toBe(11);
    expect(plan.capitalAfterGrace.toFixed(12)).toBe('1207.913395534745');
    expect(plan.monthlyRate.toFixed(12)).toBe('0.018087582484');
    expect(plan.theoreticalPayment.toFixed(12)).toBe('417.290316033445');
    expect(plan.installments.map((item) => item.dueDate)).toEqual([
      '2026-10-26',
      '2026-11-26',
      '2026-12-26',
    ]);
    expect(plan.installments.map((item) => item.interest.toDecimalPlaces(2).toFixed(2))).toEqual([
      '21.85',
      '14.70',
      '7.41',
    ]);
    expect(
      plan.installments.map((item) => item.amortization.toDecimalPlaces(2).toFixed(2)),
    ).toEqual(['395.44', '402.59', '409.88']);
    expect(plan.installments.at(-1)?.closingBalance.toFixed(2)).toBe('0.00');
  });

  it('splits principal evenly when the rate is zero', () => {
    const plan = buildFrenchSchedule({
      principal: '900',
      purchaseDate: '2026-09-15',
      baseDate: '2026-09-26',
      numberOfInstallments: 3,
      paymentDay: 26,
      dailyRate: new Decimal(0),
    });

    expect(plan.theoreticalPayment.toFixed(2)).toBe('300.00');
    expect(plan.installments.every((item) => item.interest.isZero())).toBe(true);
  });
});

describe('calculateAmountDue', () => {
  it('adds late interest to exact components and reports the rounding adjustment', () => {
    const lateDailyRate = toEffectiveDailyRate({
      rate: '0.36',
      kind: 'EFFECTIVE',
      baseDays: 360,
    });

    const result = calculateAmountDue({
      paidAt: '2026-09-30',
      obligations: [
        {
          id: 'obligation-1',
          dueDate: '2026-09-26',
          baseAmount: '603.351889788154',
          compensatoryInterest: '3.351889788154',
          originalPrincipal: '600',
          lateDailyRate,
        },
      ],
    });

    expect(result.lines[0]?.lateDays).toBe(4);
    expect(result.lines[0]?.lateInterest.toFixed(12)).toBe('2.064875029411');
    expect(result.exactTotal.toFixed(12)).toBe('605.416764817565');
    expect(result.moneyTotal).toBe('605.42');
    expect(result.roundingAdjustment).toBe('0.01');
  });

  it('excludes installments that are not yet due', () => {
    const result = calculateAmountDue({
      paidAt: '2026-09-30',
      obligations: [
        {
          id: 'future',
          dueDate: '2026-10-26',
          baseAmount: '100',
          compensatoryInterest: '10',
          originalPrincipal: '90',
          lateDailyRate: new Decimal(0),
        },
      ],
    });

    expect(result.lines).toEqual([]);
    expect(result.moneyTotal).toBe('0.00');
  });
});
