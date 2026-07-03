import React from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart,
} from 'recharts';

function fmt(value: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: 'hsl(var(--background))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    fontSize: '12px',
    color: 'hsl(var(--foreground))',
  },
};

// ─── Loan Amortization Area Chart ───
interface AmortizationChartProps {
  schedule: { period: number; principal: number; interest: number; balance: number }[];
  sampleEvery?: number;
}

export const LoanAmortizationChart: React.FC<AmortizationChartProps> = ({ schedule, sampleEvery }) => {
  const step = sampleEvery ?? Math.max(1, Math.floor(schedule.length / 30));
  const data = schedule.filter((_, i) => i % step === 0 || i === schedule.length - 1).map(r => ({
    period: r.period,
    Principal: Math.round(r.principal),
    Interest: Math.round(r.interest),
    Balance: Math.round(r.balance),
  }));

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="period" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${fmt(v)}`} width={70} />
          <Tooltip {...chartTooltipStyle} formatter={(value: number) => [`$${fmt(value)}`, undefined]} />
          <Legend wrapperStyle={{ fontSize: '11px' }} />
          <Area type="monotone" dataKey="Principal" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.3)" />
          <Area type="monotone" dataKey="Interest" stackId="1" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.2)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Yearly Summary Bar Chart ───
interface YearlySummaryChartProps {
  data: { year: number; principal: number; interest: number }[];
}

export const YearlySummaryBarChart: React.FC<YearlySummaryChartProps> = ({ data }) => (
  <div className="h-[200px] w-full">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} label={{ value: 'Year', position: 'insideBottom', offset: -2, fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${fmt(v)}`} width={70} />
        <Tooltip {...chartTooltipStyle} formatter={(value: number) => [`$${fmt(value)}`, undefined]} />
        <Legend wrapperStyle={{ fontSize: '11px' }} />
        <Bar dataKey="principal" name="Principal" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
        <Bar dataKey="interest" name="Interest" fill="hsl(var(--destructive) / 0.7)" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

// ─── Break-Even Chart ───
interface BreakEvenChartProps {
  fixedCosts: number;
  variableCostPerUnit: number;
  pricePerUnit: number;
  breakEvenUnits: number;
}

export const BreakEvenChart: React.FC<BreakEvenChartProps> = ({ fixedCosts, variableCostPerUnit, pricePerUnit, breakEvenUnits }) => {
  const maxUnits = Math.ceil(breakEvenUnits * 1.6);
  const steps = 20;
  const data = Array.from({ length: steps + 1 }, (_, i) => {
    const units = Math.round((maxUnits / steps) * i);
    return {
      units,
      Revenue: Math.round(units * pricePerUnit),
      'Total Cost': Math.round(fixedCosts + units * variableCostPerUnit),
      'Fixed Cost': Math.round(fixedCosts),
    };
  });

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="units" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} label={{ value: 'Units', position: 'insideBottom', offset: -2, fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${fmt(v)}`} width={70} />
          <Tooltip {...chartTooltipStyle} formatter={(value: number) => [`$${fmt(value)}`, undefined]} />
          <Legend wrapperStyle={{ fontSize: '11px' }} />
          <Line type="monotone" dataKey="Revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Total Cost" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Fixed Cost" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="5 5" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Cash Flow Chart ───
interface CashFlowChartProps {
  data: { label: string; inflows: number; outflows: number; netFlow: number; closingBalance: number }[];
}

export const CashFlowChart: React.FC<CashFlowChartProps> = ({ data }) => {
  const chartData = data.map(r => ({
    period: r.label,
    Inflows: Math.round(r.inflows),
    Outflows: Math.round(-r.outflows),
    Balance: Math.round(r.closingBalance),
  }));

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="period" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${fmt(v)}`} width={70} />
          <Tooltip {...chartTooltipStyle} formatter={(value: number) => [`$${fmt(value)}`, undefined]} />
          <Legend wrapperStyle={{ fontSize: '11px' }} />
          <Bar dataKey="Inflows" fill="hsl(142 71% 45% / 0.7)" radius={[2, 2, 0, 0]} />
          <Bar dataKey="Outflows" fill="hsl(var(--destructive) / 0.7)" radius={[2, 2, 0, 0]} />
          <Line type="monotone" dataKey="Balance" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Valuation Comparison Chart ───
interface ValuationChartProps {
  revenueMultiple: number;
  earningsMultiple: number;
  dcfValue: number;
}

export const ValuationChart: React.FC<ValuationChartProps> = ({ revenueMultiple, earningsMultiple, dcfValue }) => {
  const data = [
    { method: 'Revenue Multiple', value: Math.round(revenueMultiple) },
    { method: 'Earnings Multiple', value: Math.round(earningsMultiple) },
    { method: 'DCF', value: Math.round(dcfValue) },
  ];

  return (
    <div className="h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${fmt(v)}`} />
          <YAxis type="category" dataKey="method" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={110} />
          <Tooltip {...chartTooltipStyle} formatter={(value: number) => [`$${fmt(value)}`, 'Valuation']} />
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Loan Balance Over Time Chart ───
interface LoanBalanceChartProps {
  schedule: { period: number; balance: number }[];
  sampleEvery?: number;
}

export const LoanBalanceChart: React.FC<LoanBalanceChartProps> = ({ schedule, sampleEvery }) => {
  const step = sampleEvery ?? Math.max(1, Math.floor(schedule.length / 30));
  const data = schedule.filter((_, i) => i % step === 0 || i === schedule.length - 1).map(r => ({
    period: r.period,
    Balance: Math.round(r.balance),
  }));

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="period" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${fmt(v)}`} width={70} />
          <Tooltip {...chartTooltipStyle} formatter={(value: number) => [`$${fmt(value)}`, undefined]} />
          <Area type="monotone" dataKey="Balance" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
