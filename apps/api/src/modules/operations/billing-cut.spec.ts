import { describe, expect, it } from 'vitest';

import { billingCutForDueDate } from './billing-cut.js';

describe('billingCutForDueDate', () => {
  it('uses the same-month cut when it occurs before the due day', () => {
    expect(billingCutForDueDate('2026-10-26', 20)).toBe(
      '2026-10-20T23:59:59-05:00',
    );
  });

  it('uses the previous-month cut when the billing day follows the due day', () => {
    expect(billingCutForDueDate('2026-12-05', 26)).toBe(
      '2026-11-26T23:59:59-05:00',
    );
  });

  it('clamps a missing billing day to the real month end', () => {
    expect(billingCutForDueDate('2027-03-05', 30)).toBe(
      '2027-02-28T23:59:59-05:00',
    );
  });
});
