import { describe, it, expect } from 'vitest';
import {
  computeClosingRetainedEarnings,
  enforceRetainedEarningsContinuity,
  rollforwardRetainedEarnings,
  type RetainedEarningsStatementData,
} from '../retainedEarningsRollforward';

describe('Retained earnings year-over-year continuity', () => {
  it('closing equals opening + NI - dividends ± adjustments', () => {
    const data: RetainedEarningsStatementData = {
      openingBalance: 117307,
      netIncomeLoss: -46711.73,
      otherAdditions: 2582.86,
      dividendsDeclared: 0,
      otherDeductions: 0,
      closingBalance: 0,
    };
    expect(computeClosingRetainedEarnings(data)).toBeCloseTo(73178.13, 2);
  });

  it('Opening (Year N) equals Closing (Year N-1) for a June 30 fiscal year pair', () => {
    const rolled = rollforwardRetainedEarnings([
      {
        fiscalYear: 2025,
        isFirstYear: true,
        netIncomeLoss: 72508,
        dividendsDeclared: 0,
        directRetainedEarningsPostings: 44799,
      },
      {
        fiscalYear: 2026,
        isFirstYear: false,
        netIncomeLoss: -46711.73,
        dividendsDeclared: 0,
        directRetainedEarningsPostings: 2582.86,
      },
    ]);

    const fy2025 = rolled.find((r) => r.fiscalYear === 2025)!;
    const fy2026 = rolled.find((r) => r.fiscalYear === 2026)!;

    expect(fy2025.data.openingBalance).toBeCloseTo(44799, 2);
    expect(fy2025.data.closingBalance).toBeCloseTo(117307, 2);
    expect(fy2026.data.openingBalance).toBeCloseTo(fy2025.data.closingBalance, 2);
    expect(fy2026.data.openingBalance).toBeCloseTo(117307, 2);
    expect(fy2026.data.otherAdditions).toBeCloseTo(2582.86, 2);
    expect(fy2026.data.closingBalance).toBeCloseTo(73178.13, 2);
  });

  it('does not fold subsequent-year RE journals into opening', () => {
    const rolled = rollforwardRetainedEarnings([
      {
        fiscalYear: 2025,
        isFirstYear: true,
        netIncomeLoss: 72508,
        dividendsDeclared: 0,
        directRetainedEarningsPostings: 44799,
      },
      {
        fiscalYear: 2026,
        isFirstYear: false,
        netIncomeLoss: -46711.73,
        dividendsDeclared: 0,
        directRetainedEarningsPostings: 2582.86,
      },
    ]);
    const fy2026 = rolled.find((r) => r.fiscalYear === 2026)!;
    expect(fy2026.data.openingBalance).not.toBeCloseTo(119889.86, 2);
  });

  it('reclassifies an inflated SQL opening as a prior-period adjustment', () => {
    const enforced = enforceRetainedEarningsContinuity([
      {
        fiscalYear: 2025,
        data: {
          openingBalance: 44799,
          netIncomeLoss: 72508,
          otherAdditions: 0,
          dividendsDeclared: 0,
          otherDeductions: 0,
          closingBalance: 117307,
        },
      },
      {
        fiscalYear: 2026,
        data: {
          openingBalance: 119889.86,
          netIncomeLoss: -46711.73,
          otherAdditions: 0,
          dividendsDeclared: 0,
          otherDeductions: 0,
          closingBalance: 73178.13,
        },
      },
    ]);

    const fy2026 = enforced.find((r) => r.fiscalYear === 2026)!;
    expect(fy2026.data.openingBalance).toBeCloseTo(117307, 2);
    expect(fy2026.data.otherAdditions).toBeCloseTo(2582.86, 2);
    expect(fy2026.data.closingBalance).toBeCloseTo(73178.13, 2);
    expect(computeClosingRetainedEarnings(fy2026.data)).toBeCloseTo(73178.13, 2);
  });

  it('stitches adjacent June 30 fiscal periods by date, not calendar-year number', () => {
    const enforced = enforceRetainedEarningsContinuity([
      {
        fiscalYear: 2026,
        startDate: new Date(2025, 6, 1),
        endDate: new Date(2026, 5, 30),
        data: {
          openingBalance: 119889.86,
          netIncomeLoss: -46711.73,
          otherAdditions: 0,
          dividendsDeclared: 0,
          otherDeductions: 0,
          closingBalance: 73178.13,
        },
      },
      {
        fiscalYear: 2025,
        startDate: new Date(2024, 6, 1),
        endDate: new Date(2025, 5, 30),
        data: {
          openingBalance: 44799,
          netIncomeLoss: 72508,
          otherAdditions: 0,
          dividendsDeclared: 0,
          otherDeductions: 0,
          closingBalance: 117307,
        },
      },
    ]);

    const fy2026 = enforced.find((r) => r.fiscalYear === 2026)!;
    expect(fy2026.data.openingBalance).toBeCloseTo(117307, 2);
    expect(fy2026.data.otherAdditions).toBeCloseTo(2582.86, 2);
  });

  it('does not stitch non-adjacent fiscal years', () => {
    const enforced = enforceRetainedEarningsContinuity([
      {
        fiscalYear: 2024,
        data: {
          openingBalance: 0,
          netIncomeLoss: 100,
          otherAdditions: 0,
          dividendsDeclared: 0,
          otherDeductions: 0,
          closingBalance: 100,
        },
      },
      {
        fiscalYear: 2026,
        data: {
          openingBalance: 500,
          netIncomeLoss: 50,
          otherAdditions: 0,
          dividendsDeclared: 0,
          otherDeductions: 0,
          closingBalance: 550,
        },
      },
    ]);

    expect(enforced.find((r) => r.fiscalYear === 2026)!.data.openingBalance).toBe(500);
  });

  it('is a no-op when opening already equals prior closing', () => {
    const input = [
      {
        fiscalYear: 2025,
        data: {
          openingBalance: 44799,
          netIncomeLoss: 72508,
          otherAdditions: 0,
          dividendsDeclared: 0,
          otherDeductions: 0,
          closingBalance: 117307,
        },
      },
      {
        fiscalYear: 2026,
        data: {
          openingBalance: 117307,
          netIncomeLoss: -46711.73,
          otherAdditions: 0,
          dividendsDeclared: 0,
          otherDeductions: 0,
          closingBalance: 70595.27,
        },
      },
    ];
    const enforced = enforceRetainedEarningsContinuity(input);
    expect(enforced[1].data.openingBalance).toBeCloseTo(117307, 2);
    expect(enforced[1].data.otherAdditions).toBe(0);
    expect(enforced[1].data.closingBalance).toBeCloseTo(70595.27, 2);
  });
});
