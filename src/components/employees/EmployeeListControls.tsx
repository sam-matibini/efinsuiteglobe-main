import { ArrowDown, ArrowUp, ArrowUpDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { countActiveFilters, EMPTY_FILTERS, EmployeeFilters, HOURS_PER_YEAR, SortKey, SortState } from '@/lib/employeeListView';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'terminated', label: 'Terminated' },
];
const EMPLOYMENT_OPTIONS = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'temporary', label: 'Temporary' },
];

interface FilterBarProps {
  filters: EmployeeFilters;
  onChange: (next: EmployeeFilters) => void;
  departments: string[];
  /** Bank names to filter by. Leave out to hide the bank filter. */
  banks?: string[];
  shown: number;
  total: number;
  currencySymbol: string;
}

export function EmployeeFilterBar({ filters, onChange, departments, banks, shown, total, currencySymbol }: FilterBarProps) {
  const set = (patch: Partial<EmployeeFilters>) => onChange({ ...filters, ...patch });
  const active = countActiveFilters(filters);
  const moreActive = (filters.hireFrom || filters.hireTo ? 1 : 0) + (filters.payMin || filters.payMax ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, Employee ID, job title, department or phone…"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            className="pl-10"
            aria-label="Search employees"
          />
        </div>

        <Select value={filters.status} onValueChange={(v) => set({ status: v })}>
          <SelectTrigger className="w-36" aria-label="Status"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.department} onValueChange={(v) => set({ department: v })}>
          <SelectTrigger className="w-44" aria-label="Department"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            <SelectItem value="__none__">No department</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.employmentType} onValueChange={(v) => set({ employmentType: v })}>
          <SelectTrigger className="w-40" aria-label="Employment type"><SelectValue placeholder="Employment type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {EMPLOYMENT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {banks && (
          <Select value={filters.bank} onValueChange={(v) => set({ bank: v })}>
            <SelectTrigger className="w-40" aria-label="Bank"><SelectValue placeholder="Bank" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All banks</SelectItem>
              {banks.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              <SelectItem value="__none__">No bank on file</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Select value={filters.payType} onValueChange={(v) => set({ payType: v as EmployeeFilters['payType'] })}>
          <SelectTrigger className="w-36" aria-label="Pay type"><SelectValue placeholder="Pay type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All pay types</SelectItem>
            <SelectItem value="salary">Salaried</SelectItem>
            <SelectItem value="hourly">Hourly</SelectItem>
            <SelectItem value="none">No pay rate</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              More filters
              {moreActive > 0 && <span className="rounded-full bg-primary text-primary-foreground text-[10px] px-1.5">{moreActive}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Hire date</Label>
              <div className="flex items-center gap-2">
                <Input type="date" value={filters.hireFrom} onChange={(e) => set({ hireFrom: e.target.value })} aria-label="Hired from" />
                <span className="text-muted-foreground">–</span>
                <Input type="date" value={filters.hireTo} onChange={(e) => set({ hireTo: e.target.value })} aria-label="Hired to" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Annual pay ({currencySymbol})</Label>
              <div className="flex items-center gap-2">
                <Input inputMode="numeric" placeholder="Min" value={filters.payMin} onChange={(e) => set({ payMin: e.target.value })} aria-label="Minimum annual pay" />
                <span className="text-muted-foreground">–</span>
                <Input inputMode="numeric" placeholder="Max" value={filters.payMax} onChange={(e) => set({ payMax: e.target.value })} aria-label="Maximum annual pay" />
              </div>
              <p className="text-[11px] text-muted-foreground">Hourly staff are compared at rate × {HOURS_PER_YEAR.toLocaleString()} hours.</p>
            </div>
            {moreActive > 0 && (
              <Button variant="ghost" size="sm" onClick={() => set({ hireFrom: '', hireTo: '', payMin: '', payMax: '' })}>Clear these</Button>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing <span className="font-medium text-foreground">{shown.toLocaleString()}</span> of {total.toLocaleString()} employees
          {active > 0 && ` · ${active} filter${active === 1 ? '' : 's'} applied`}
        </span>
        {(active > 0 || filters.search) && (
          <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => onChange(EMPTY_FILTERS)}>
            <X className="w-3 h-3" /> Clear all
          </Button>
        )}
      </div>
    </div>
  );
}

interface SortHeaderProps {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}

/** A column header button that sorts by its column and shows the direction. */
export function SortHeader({ label, sortKey, sort, onSort, align = 'left' }: SortHeaderProps) {
  const activeCol = sort.key === sortKey;
  const Icon = !activeCol ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn('inline-flex items-center gap-1 hover:text-foreground', align === 'right' && 'flex-row-reverse', activeCol && 'text-foreground')}
      aria-label={`Sort by ${label}${activeCol ? (sort.dir === 'asc' ? ', ascending' : ', descending') : ''}`}
    >
      {label}
      <Icon className={cn('w-3.5 h-3.5', !activeCol && 'opacity-40')} />
    </button>
  );
}
