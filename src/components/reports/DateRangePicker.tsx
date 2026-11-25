import { useEffect, useMemo, useState } from 'react';
import { format, isValid, parse } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { DATE_RANGE_PRESETS, DateRangePreset, PRESET_LABEL, detectPreset, rangeForPreset } from '@/lib/reportDateRanges';

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onChange: (start: Date, end: Date) => void;
  fiscalYearEndMonth?: number;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

const toInput = (d: Date) => format(d, 'yyyy-MM-dd');
const fromInput = (s: string): Date | null => {
  const d = parse(s, 'yyyy-MM-dd', new Date());
  return isValid(d) ? d : null;
};

/**
 * Zoho Books–style report date filter: one button showing the period name and
 * its dates, a preset list, and a Custom panel with typable From/To dates.
 */
export function DateRangePicker({ startDate, endDate, onChange, fiscalYearEndMonth = 12, align = 'end', className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const active = useMemo(() => detectPreset(startDate, endDate, new Date(), fiscalYearEndMonth), [startDate, endDate, fiscalYearEndMonth]);
  const [showCustom, setShowCustom] = useState(active === 'custom');
  const [from, setFrom] = useState(toInput(startDate));
  const [to, setTo] = useState(toInput(endDate));
  const [month, setMonth] = useState<Date>(startDate);

  useEffect(() => {
    if (!open) return;
    setShowCustom(active === 'custom');
    setFrom(toInput(startDate));
    setTo(toInput(endDate));
    setMonth(startDate);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const fromDate = fromInput(from);
  const toDate = fromInput(to);
  const customError = !fromDate || !toDate ? 'Enter both dates.' : fromDate > toDate ? 'From date is after To date.' : null;

  const pick = (preset: Exclude<DateRangePreset, 'custom'>) => {
    const r = rangeForPreset(preset, new Date(), fiscalYearEndMonth);
    onChange(r.start, r.end);
    setOpen(false);
  };

  const applyCustom = () => {
    if (customError || !fromDate || !toDate) return;
    onChange(fromDate, toDate);
    setOpen(false);
  };

  const sameDay = toInput(startDate) === toInput(endDate);
  const rangeText = sameDay
    ? format(startDate, 'dd MMM yyyy')
    : `${format(startDate, 'dd MMM yyyy')} – ${format(endDate, 'dd MMM yyyy')}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('gap-2 justify-between min-w-[260px] bg-background', className)} aria-label="Report period">
          <span className="flex items-center gap-2 min-w-0">
            <CalendarDays className="w-4 h-4 shrink-0 text-muted-foreground" />
            <span className="font-medium">{PRESET_LABEL[active]}</span>
            <span className="text-muted-foreground truncate">{rangeText}</span>
          </span>
          <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-0 bg-popover border border-border z-50">
        <div className="flex">
          <ul className="w-44 py-1 border-r border-border" role="listbox" aria-label="Date range presets">
            {DATE_RANGE_PRESETS.map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active === p.key}
                  onClick={() => pick(p.key)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-1.5 text-sm text-left hover:bg-muted',
                    active === p.key && !showCustom && 'text-primary font-medium',
                  )}
                >
                  {p.label}
                  {active === p.key && !showCustom && <Check className="w-3.5 h-3.5" />}
                </button>
              </li>
            ))}
            <li className="border-t border-border mt-1 pt-1">
              <button
                type="button"
                role="option"
                aria-selected={showCustom}
                onClick={() => setShowCustom(true)}
                className={cn('w-full flex items-center justify-between px-3 py-1.5 text-sm text-left hover:bg-muted', showCustom && 'text-primary font-medium')}
              >
                Custom
                {showCustom && <Check className="w-3.5 h-3.5" />}
              </button>
            </li>
          </ul>

          {showCustom && (
            <div className="p-3 space-y-3">
              <div className="flex items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="drp-from" className="text-xs">From</Label>
                  <Input id="drp-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); const d = fromInput(e.target.value); if (d) setMonth(d); }} className="h-9 w-40" />
                </div>
                <span className="pb-2 text-muted-foreground">–</span>
                <div className="space-y-1">
                  <Label htmlFor="drp-to" className="text-xs">To</Label>
                  <Input id="drp-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
                </div>
              </div>
              <Calendar
                mode="range"
                numberOfMonths={2}
                month={month}
                onMonthChange={setMonth}
                selected={{ from: fromDate ?? undefined, to: toDate ?? undefined } as DateRange}
                onSelect={(r: DateRange | undefined) => {
                  if (r?.from) setFrom(toInput(r.from));
                  setTo(r?.to ? toInput(r.to) : r?.from ? toInput(r.from) : to);
                }}
                className="p-0 pointer-events-auto"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-destructive">{customError ?? ''}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button size="sm" onClick={applyCustom} disabled={!!customError}>Apply</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
