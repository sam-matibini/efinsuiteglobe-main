// Pure calculation functions for the AI Financial Toolkit

export interface AmortizationRow {
  period: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
  isGracePeriod?: boolean;
}

export interface LoanResult {
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  schedule: AmortizationRow[];
  paymentFrequency?: string;
  effectivePayment?: number;
}

export function calculateLoanAmortization(
  principal: number,
  annualRate: number,
  termMonths: number,
  options?: {
    paymentFrequency?: 'monthly' | 'biweekly' | 'weekly';
    extraPayment?: number;
    gracePeriodMonths?: number;
  }
): LoanResult {
  const frequency = options?.paymentFrequency ?? 'monthly';
  const extraPayment = options?.extraPayment ?? 0;
  const gracePeriodMonths = options?.gracePeriodMonths ?? 0;

  // Determine periods per year and total periods
  let periodsPerYear: number;
  switch (frequency) {
    case 'biweekly': periodsPerYear = 26; break;
    case 'weekly': periodsPerYear = 52; break;
    default: periodsPerYear = 12; break;
  }

  const periodRate = annualRate / 100 / periodsPerYear;
  const gracePeriods = Math.round(gracePeriodMonths * (periodsPerYear / 12));
  const totalPeriodsIncGrace = Math.round(termMonths * (periodsPerYear / 12));
  const amortPeriods = totalPeriodsIncGrace - gracePeriods;

  let basePayment: number;
  if (periodRate === 0) {
    basePayment = principal / Math.max(amortPeriods, 1);
  } else {
    basePayment =
      (principal * periodRate * Math.pow(1 + periodRate, amortPeriods)) /
      (Math.pow(1 + periodRate, amortPeriods) - 1);
  }

  const schedule: AmortizationRow[] = [];
  let balance = principal;

  // Grace period: interest-only payments
  for (let i = 1; i <= gracePeriods; i++) {
    const interest = balance * periodRate;
    schedule.push({
      period: i,
      payment: interest,
      principal: 0,
      interest,
      balance,
      isGracePeriod: true,
    });
  }

  // Amortization period
  for (let i = 1; i <= amortPeriods; i++) {
    if (balance <= 0) break;
    const interest = balance * periodRate;
    const totalPayment = Math.min(basePayment + extraPayment, balance + interest);
    const principalPart = totalPayment - interest;
    balance = Math.max(0, balance - principalPart);
    schedule.push({
      period: gracePeriods + i,
      payment: totalPayment,
      principal: principalPart,
      interest,
      balance,
      isGracePeriod: false,
    });
  }

  const actualTotalPayment = schedule.reduce((s, r) => s + r.payment, 0);

  return {
    monthlyPayment: basePayment,
    effectivePayment: basePayment + extraPayment,
    totalPayment: actualTotalPayment,
    totalInterest: actualTotalPayment - principal,
    schedule,
    paymentFrequency: frequency,
  };
}

export interface ValuationResult {
  method: string;
  value: number;
  details: Record<string, number>;
}

export function calculateBusinessValuation(
  method: 'multiple' | 'dcf',
  inputs: {
    revenue?: number;
    earnings?: number;
    multiplier?: number;
    cashFlows?: number[];
    discountRate?: number;
    terminalGrowth?: number;
  }
): ValuationResult {
  if (method === 'multiple') {
    const base = inputs.earnings ?? inputs.revenue ?? 0;
    const mult = inputs.multiplier ?? 3;
    return {
      method: inputs.earnings ? 'Earnings Multiple' : 'Revenue Multiple',
      value: base * mult,
      details: { base, multiplier: mult, valuation: base * mult },
    };
  }

  // DCF
  const flows = inputs.cashFlows ?? [];
  const rate = (inputs.discountRate ?? 10) / 100;
  const termGrowth = (inputs.terminalGrowth ?? 2) / 100;

  let pvSum = 0;
  flows.forEach((cf, i) => {
    pvSum += cf / Math.pow(1 + rate, i + 1);
  });

  const lastCF = flows[flows.length - 1] ?? 0;
  const terminalValue = rate > termGrowth ? (lastCF * (1 + termGrowth)) / (rate - termGrowth) : 0;
  const pvTerminal = terminalValue / Math.pow(1 + rate, flows.length);

  return {
    method: 'Discounted Cash Flow',
    value: pvSum + pvTerminal,
    details: { pvCashFlows: pvSum, terminalValue, pvTerminal, totalValue: pvSum + pvTerminal },
  };
}

// Unified valuation computing all methods at once
export interface UnifiedValuationResult {
  revenueMultiple: number;
  earningsMultiple: number;
  dcfValue: number;
  details: Record<string, number>;
}

export function calculateUnifiedValuation(inputs: {
  revenue: number;
  earnings: number;
  revenueMultiplier: number;
  earningsMultiplier: number;
  growthRate: number;
  discountRate: number;
}): UnifiedValuationResult {
  const revenueMultiple = inputs.revenue * inputs.revenueMultiplier;
  const earningsMultiple = inputs.earnings * inputs.earningsMultiplier;

  // Simple DCF: project 5 years of earnings growing at growthRate, discount at discountRate
  const rate = inputs.discountRate / 100;
  const growth = inputs.growthRate / 100;
  let pvSum = 0;
  let lastCF = inputs.earnings;
  for (let i = 1; i <= 5; i++) {
    lastCF = lastCF * (1 + growth);
    pvSum += lastCF / Math.pow(1 + rate, i);
  }
  const terminalValue = rate > growth ? (lastCF * (1 + growth)) / (rate - growth) : 0;
  const pvTerminal = terminalValue / Math.pow(1 + rate, 5);
  const dcfValue = pvSum + pvTerminal;

  return {
    revenueMultiple,
    earningsMultiple,
    dcfValue,
    details: { revenueMultiple, earningsMultiple, pvCashFlows: pvSum, terminalValue, pvTerminal, dcfValue },
  };
}

export interface BreakEvenResult {
  breakEvenUnits: number;
  breakEvenRevenue: number;
  contributionMargin: number;
  contributionMarginRatio: number;
}

export function calculateBreakEven(
  fixedCosts: number,
  variableCostPerUnit: number,
  sellingPricePerUnit: number
): BreakEvenResult {
  const contributionMargin = sellingPricePerUnit - variableCostPerUnit;
  const contributionMarginRatio = sellingPricePerUnit > 0 ? contributionMargin / sellingPricePerUnit : 0;
  const breakEvenUnits = contributionMargin > 0 ? fixedCosts / contributionMargin : 0;
  const breakEvenRevenue = breakEvenUnits * sellingPricePerUnit;

  return { breakEvenUnits, breakEvenRevenue, contributionMargin, contributionMarginRatio };
}

export interface CashFlowPeriod {
  period: number;
  label: string;
  inflows: number;
  outflows: number;
  netFlow: number;
  closingBalance: number;
}

export function calculateCashFlowForecast(
  openingBalance: number,
  periods: { label: string; inflows: number; outflows: number }[]
): CashFlowPeriod[] {
  let balance = openingBalance;
  return periods.map((p, i) => {
    const netFlow = p.inflows - p.outflows;
    balance += netFlow;
    return {
      period: i + 1,
      label: p.label,
      inflows: p.inflows,
      outflows: p.outflows,
      netFlow,
      closingBalance: balance,
    };
  });
}

export function calculateROI(investmentCost: number, gain: number): number {
  if (investmentCost === 0) return 0;
  return ((gain - investmentCost) / investmentCost) * 100;
}

export function calculateNPV(discountRate: number, initialInvestment: number, cashFlows: number[]): number {
  const rate = discountRate / 100;
  let npv = -initialInvestment;
  cashFlows.forEach((cf, i) => {
    npv += cf / Math.pow(1 + rate, i + 1);
  });
  return npv;
}

export function calculateIRR(cashFlows: number[], guess = 0.1): number {
  // Newton-Raphson method
  let rate = guess;
  const maxIter = 1000;
  const tolerance = 1e-7;

  for (let i = 0; i < maxIter; i++) {
    let npv = 0;
    let dnpv = 0;
    cashFlows.forEach((cf, t) => {
      npv += cf / Math.pow(1 + rate, t);
      dnpv -= (t * cf) / Math.pow(1 + rate, t + 1);
    });

    if (Math.abs(npv) < tolerance) return rate * 100;
    if (dnpv === 0) break;
    rate -= npv / dnpv;
  }

  return rate * 100;
}

export function calculateMIRR(
  cashFlows: number[],
  financeRate: number,
  reinvestmentRate: number
): number {
  const fRate = financeRate / 100;
  const rRate = reinvestmentRate / 100;
  const n = cashFlows.length - 1;
  if (n <= 0) return 0;

  // PV of negative cash flows (costs) discounted at finance rate
  let pvNeg = 0;
  // FV of positive cash flows compounded at reinvestment rate
  let fvPos = 0;

  cashFlows.forEach((cf, t) => {
    if (cf < 0) {
      pvNeg += cf / Math.pow(1 + fRate, t);
    } else {
      fvPos += cf * Math.pow(1 + rRate, n - t);
    }
  });

  if (pvNeg === 0) return 0;
  const mirr = Math.pow(fvPos / Math.abs(pvNeg), 1 / n) - 1;
  return mirr * 100;
}

export function calculateFutureValue(
  presentValue: number,
  annualRate: number,
  periods: number,
  options?: {
    compounding?: 'monthly' | 'quarterly' | 'annually';
    periodicContribution?: number;
    contributionTiming?: 'beginning' | 'end';
  }
): number {
  const rate = annualRate / 100;
  const compounding = options?.compounding ?? 'annually';
  const contribution = options?.periodicContribution ?? 0;
  const timing = options?.contributionTiming ?? 'end';

  let n: number; // compounding periods per year
  switch (compounding) {
    case 'monthly': n = 12; break;
    case 'quarterly': n = 4; break;
    default: n = 1; break;
  }

  const totalPeriods = periods * n;
  const periodRate = rate / n;

  // FV of lump sum
  const fvLumpSum = presentValue * Math.pow(1 + periodRate, totalPeriods);

  // FV of annuity (periodic contributions)
  let fvAnnuity = 0;
  if (contribution > 0 && periodRate > 0) {
    fvAnnuity = contribution * ((Math.pow(1 + periodRate, totalPeriods) - 1) / periodRate);
    if (timing === 'beginning') {
      fvAnnuity *= (1 + periodRate);
    }
  } else if (contribution > 0) {
    fvAnnuity = contribution * totalPeriods;
  }

  return fvLumpSum + fvAnnuity;
}
