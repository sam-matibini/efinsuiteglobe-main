/**
 * Retained Earnings year-over-year rollforward (ASPE / IAS 1 / CRA GIFI).
 *
 * Identity that must always hold:
 *   Opening RE (Year N) = Closing RE (Year N-1)
 *   Closing RE = Opening RE + Net Income - Dividends + Other additions - Other deductions
 *
 * In-year direct postings to the Retained Earnings account (non CLOSE-*):
 *   - First year of books: treated as opening (brought-forward / opening-balance journals)
 *   - Later years: treated as prior-period adjustments (other additions/deductions)
 *     so the opening balance continues to equal the prior year's closing balance.
 */

export interface RetainedEarningsStatementData {
  openingBalance: number;
  netIncomeLoss: number;
  otherAdditions: number;
  dividendsDeclared: number;
  otherDeductions: number;
  closingBalance: number;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeClosingRetainedEarnings(data: RetainedEarningsStatementData): number {
  return roundMoney(
    data.openingBalance +
      data.netIncomeLoss -
      data.dividendsDeclared +
      data.otherAdditions -
      data.otherDeductions
  );
}

/**
 * Force Opening(N) = Closing(N-1) across adjacent fiscal years.
 *
 * Any difference that was previously folded into opening is reclassified as a
 * prior-period adjustment so the reported closing balance is unchanged and
 * Opening + NI - Dividends ± PPA still equals Closing.
 */
function areAdjacentFiscalPeriods(
  earlier: { fiscalYear: number; startDate?: Date; endDate?: Date },
  later: { fiscalYear: number; startDate?: Date; endDate?: Date }
): boolean {
  if (earlier.endDate && later.startDate) {
    const earlierEnd = Date.UTC(
      earlier.endDate.getFullYear(),
      earlier.endDate.getMonth(),
      earlier.endDate.getDate()
    );
    const laterStart = Date.UTC(
      later.startDate.getFullYear(),
      later.startDate.getMonth(),
      later.startDate.getDate()
    );
    const days = (laterStart - earlierEnd) / 86_400_000;
    return days >= 0 && days <= 2;
  }
  return later.fiscalYear === earlier.fiscalYear + 1;
}

export function enforceRetainedEarningsContinuity<
  T extends {
    fiscalYear: number;
    data: RetainedEarningsStatementData;
    startDate?: Date;
    endDate?: Date;
  }
>(statements: T[]): T[] {
  const result = [...statements]
    .sort((a, b) => {
      if (a.endDate && b.endDate) return a.endDate.getTime() - b.endDate.getTime();
      return a.fiscalYear - b.fiscalYear;
    })
    .map((s) => ({
      ...s,
      data: { ...s.data },
    }));

  for (let i = 1; i < result.length; i++) {
    if (!areAdjacentFiscalPeriods(result[i - 1], result[i])) {
      continue;
    }

    const priorClosing = roundMoney(result[i - 1].data.closingBalance);
    const current = result[i].data;
    const gap = roundMoney(current.openingBalance - priorClosing);

    if (Math.abs(gap) < 0.005) {
      current.openingBalance = priorClosing;
      continue;
    }

    current.openingBalance = priorClosing;
    const netOther = roundMoney(current.otherAdditions - current.otherDeductions + gap);
    if (netOther >= 0) {
      current.otherAdditions = netOther;
      current.otherDeductions = 0;
    } else {
      current.otherAdditions = 0;
      current.otherDeductions = roundMoney(-netOther);
    }
    current.closingBalance = computeClosingRetainedEarnings(current);
  }

  return result;
}

export interface RetainedEarningsYearInput {
  fiscalYear: number;
  isFirstYear: boolean;
  netIncomeLoss: number;
  dividendsDeclared: number;
  /** Direct (non CLOSE-*) postings to the RE account during the year */
  directRetainedEarningsPostings: number;
}

/**
 * Pure year-walk used by tests to lock the SQL rollforward contract.
 * First-year direct RE postings land in opening; later years land in PPA.
 */
export function rollforwardRetainedEarnings(
  years: RetainedEarningsYearInput[]
): { fiscalYear: number; data: RetainedEarningsStatementData }[] {
  const sorted = [...years].sort((a, b) => a.fiscalYear - b.fiscalYear);
  const out: { fiscalYear: number; data: RetainedEarningsStatementData }[] = [];
  let previousClosing: number | null = null;

  for (const year of sorted) {
    const direct = roundMoney(year.directRetainedEarningsPostings);
    let openingBalance: number;
    let otherAdditions = 0;
    let otherDeductions = 0;

    if (previousClosing === null || year.isFirstYear) {
      openingBalance = direct;
    } else {
      openingBalance = previousClosing;
      if (direct >= 0) {
        otherAdditions = direct;
      } else {
        otherDeductions = roundMoney(-direct);
      }
    }

    const data: RetainedEarningsStatementData = {
      openingBalance: roundMoney(openingBalance),
      netIncomeLoss: roundMoney(year.netIncomeLoss),
      otherAdditions: roundMoney(otherAdditions),
      dividendsDeclared: roundMoney(year.dividendsDeclared),
      otherDeductions: roundMoney(otherDeductions),
      closingBalance: 0,
    };
    data.closingBalance = computeClosingRetainedEarnings(data);
    previousClosing = data.closingBalance;
    out.push({ fiscalYear: year.fiscalYear, data });
  }

  return out;
}
