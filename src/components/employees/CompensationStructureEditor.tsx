import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Lock } from 'lucide-react';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

export type CompLineKind = 'earning' | 'deduction';

export interface CompensationLine {
  id: string;
  description: string;
  kind: CompLineKind;
  ratePct: number;       // % of Gross Annual Salary (Total Actual Gross)
  isSystem?: boolean;    // Seeded row — cannot be deleted
  system_key?: string;   // Stable key used by the payroll engine (basic, housing, transport, utility, pension, rent_relief)
}

export interface CompensationStructure {
  items: CompensationLine[];
}

const NG_DEFAULTS: CompensationLine[] = [
  { id: 'sys-basic',     description: 'Basic Salary',              kind: 'earning',   ratePct: 50, isSystem: true, system_key: 'basic' },
  { id: 'sys-housing',   description: 'Housing Allowance',         kind: 'earning',   ratePct: 25, isSystem: true, system_key: 'housing' },
  { id: 'sys-transport', description: 'Transport Allowance',       kind: 'earning',   ratePct: 15, isSystem: true, system_key: 'transport' },
  { id: 'sys-utility',   description: 'Utility/Other Allowances',  kind: 'earning',   ratePct: 10, isSystem: true, system_key: 'utility' },
  { id: 'sys-pension',   description: 'Annual Pension',            kind: 'deduction', ratePct: 10, isSystem: true, system_key: 'pension' },
  { id: 'sys-rent',      description: 'Annual Rent Relief',        kind: 'deduction', ratePct: 20, isSystem: true, system_key: 'rent_relief' },
];

const GENERIC_DEFAULTS: CompensationLine[] = [
  { id: 'sys-basic', description: 'Basic Salary', kind: 'earning', ratePct: 100, isSystem: true, system_key: 'basic' },
];

export function getDefaultCompensationStructure(countryCode?: string): CompensationStructure {
  const cc = (countryCode || '').toUpperCase();
  return { items: cc === 'NG' ? NG_DEFAULTS.map((r) => ({ ...r })) : GENERIC_DEFAULTS.map((r) => ({ ...r })) };
}

interface Props {
  value: CompensationStructure | null;
  onChange: (next: CompensationStructure) => void;
  annualSalary: number;
  countryCode: string;
}

/** Nigerian PAYE bands (Nigeria Tax Act 2025, monthly-basis approximation applied yearly). */
const NG_PAYE_BANDS = [
  { upTo: 800_000,    rate: 0.00 },
  { upTo: 3_000_000,  rate: 0.15 },
  { upTo: 12_000_000, rate: 0.18 },
  { upTo: 25_000_000, rate: 0.21 },
  { upTo: 50_000_000, rate: 0.23 },
  { upTo: Infinity,   rate: 0.25 },
];
function ngPaye(taxable: number): number {
  let remaining = Math.max(0, taxable);
  let prev = 0;
  let tax = 0;
  for (const b of NG_PAYE_BANDS) {
    const slice = Math.min(remaining, b.upTo - prev);
    if (slice <= 0) break;
    tax += slice * b.rate;
    remaining -= slice;
    prev = b.upTo;
    if (remaining <= 0) break;
  }
  return tax;
}

export function CompensationStructureEditor({ value, onChange, annualSalary, countryCode }: Props) {
  const { formatWithSymbol } = useCurrencyFormatter();
  const cc = (countryCode || 'CA').toUpperCase();

  const items = value?.items ?? getDefaultCompensationStructure(cc).items;

  const update = (id: string, patch: Partial<CompensationLine>) => {
    onChange({ items: items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
  };
  const remove = (id: string) => {
    onChange({ items: items.filter((it) => it.id !== id) });
  };
  const add = () => {
    onChange({
      items: [
        ...items,
        {
          id: `custom-${Date.now()}`,
          description: 'New line item',
          kind: 'earning',
          ratePct: 0,
        },
      ],
    });
  };
  const resetDefaults = () => onChange(getDefaultCompensationStructure(cc));

  // Derived totals (annual)
  const totals = useMemo(() => {
    const annual = Number(annualSalary) || 0;
    const earningsPct = items.filter((i) => i.kind === 'earning').reduce((s, i) => s + (i.ratePct || 0), 0);
    const totalGross = annual; // Gross = Annual Salary entered
    const totalActualGross = totalGross * (earningsPct / 100 || 1); // If earnings sum to 100% => equals gross

    const bySysKey = new Map(items.map((i) => [i.system_key || i.id, i]));
    const pensionPct = (bySysKey.get('pension')?.ratePct ?? 0) / 100;
    const rentReliefPct = (bySysKey.get('rent_relief')?.ratePct ?? 0) / 100;

    const annualPension = totalGross * pensionPct;
    // Nigerian rent relief: 20% of assumed rent, capped at ₦500,000 (NTA 2025).
    // We compute "Annual Rent Calculated" as the housing allowance if present, else 0.
    const housing = (bySysKey.get('housing')?.ratePct ?? 0) / 100 * totalGross;
    const annualRentCalculated = housing;
    const annualRentRelief = Math.min(annualRentCalculated * rentReliefPct, 500_000);

    const taxable = Math.max(0, totalGross - annualPension - annualRentRelief);
    const totalAnnualTax = cc === 'NG' ? ngPaye(taxable) : 0;

    const monthlyPension = annualPension / 12;
    const monthlyPaye = totalAnnualTax / 12;
    const monthlyGross = totalGross / 12;
    const totalMonthlyDeduction = monthlyPension + monthlyPaye;
    const monthlyNet = monthlyGross - totalMonthlyDeduction;

    return {
      totalGross,
      totalActualGross,
      annualPension,
      annualRentCalculated,
      annualRentRelief,
      taxable,
      totalAnnualTax,
      monthlyPension,
      monthlyPaye,
      totalMonthlyDeduction,
      monthlyNet,
    };
  }, [items, annualSalary, cc]);

  const fmt = (n: number) => formatWithSymbol(Number.isFinite(n) ? n : 0);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">Salary Structure & Allowances</h4>
          <p className="text-xs text-muted-foreground">
            Define earnings and deductions as a % of Annual Salary. Add custom lines as needed.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={resetDefaults}>
            Reset to defaults
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={add}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add line
          </Button>
        </div>
      </div>

      {/* Header row */}
      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
        <div className="col-span-5">Description</div>
        <div className="col-span-2">Type</div>
        <div className="col-span-2">Rate (%)</div>
        <div className="col-span-2 text-right">Amount (annual)</div>
        <div className="col-span-1" />
      </div>

      <div className="space-y-2">
        {items.map((it) => {
          const amount = (Number(annualSalary) || 0) * ((it.ratePct || 0) / 100);
          return (
            <div key={it.id} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-5">
                <Input
                  value={it.description}
                  onChange={(e) => update(it.id, { description: e.target.value })}
                  disabled={it.isSystem}
                />
              </div>
              <div className="col-span-2">
                <Select
                  value={it.kind}
                  onValueChange={(v: CompLineKind) => update(it.id, { kind: v })}
                  disabled={it.isSystem}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="earning">Earning</SelectItem>
                    <SelectItem value="deduction">Deduction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  step="0.01"
                  value={it.ratePct}
                  onChange={(e) => update(it.id, { ratePct: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="col-span-2 text-right text-sm tabular-nums">{fmt(amount)}</div>
              <div className="col-span-1 flex justify-end">
                {it.isSystem ? (
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(it.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Computed totals */}
      <div className="border-t pt-3 mt-3">
        <div className="text-xs font-medium mb-2 text-muted-foreground">Computed Summary</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <SummaryRow label="Gross Pay (Annual)" value={fmt(totals.totalGross)} />
          <SummaryRow label="Total Actual Gross Salary" value={fmt(totals.totalActualGross)} />
          <SummaryRow label="Annual Rent Calculated" value={fmt(totals.annualRentCalculated)} />
          <SummaryRow label="Annual Rent Relief" value={fmt(totals.annualRentRelief)} />
          <SummaryRow label="Annual Pension" value={fmt(totals.annualPension)} />
          <SummaryRow label="Total Annual Taxable Income" value={fmt(totals.taxable)} />
          <SummaryRow label={`Total Annual Tax${cc === 'NG' ? ' (PAYE)' : ''}`} value={fmt(totals.totalAnnualTax)} />
          <SummaryRow label="Monthly Pension" value={fmt(totals.monthlyPension)} />
          <SummaryRow label="Monthly PAYE" value={fmt(totals.monthlyPaye)} />
          <SummaryRow label="Total Monthly Deduction" value={fmt(totals.totalMonthlyDeduction)} strong />
          <SummaryRow label="Monthly Net Pay" value={fmt(totals.monthlyNet)} strong highlight />
        </div>
        {cc !== 'NG' && (
          <p className="text-xs text-muted-foreground mt-3">
            Annual tax uses country-specific rules during payroll processing; the value above is a
            structural preview only for non-Nigerian jurisdictions.
          </p>
        )}
      </div>
    </Card>
  );
}

function SummaryRow({
  label, value, strong, highlight,
}: { label: string; value: string; strong?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1 ${highlight ? 'bg-primary/5 px-2 rounded' : ''}`}>
      <span className={strong ? 'font-medium' : 'text-muted-foreground'}>{label}</span>
      <span className={`tabular-nums ${strong ? 'font-semibold' : ''}`}>{value}</span>
    </div>
  );
}
