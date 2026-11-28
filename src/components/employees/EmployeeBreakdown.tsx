import { useMemo, useState } from 'react';
import { Briefcase, Building2, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BreakdownKey, EmployeeFilters, headcountBreakdown, ListEmployee } from '@/lib/employeeListView';

const VIEWS: { key: BreakdownKey; label: string; icon: typeof Users; filter: 'department' | 'position' | 'employmentType' }[] = [
  { key: 'department', label: 'Departments', icon: Building2, filter: 'department' },
  { key: 'position', label: 'Positions', icon: Briefcase, filter: 'position' },
  { key: 'employment_type', label: 'Employment Types', icon: Users, filter: 'employmentType' },
];
const COLLAPSED = 12;

interface Props {
  employees: ListEmployee[];
  filters: EmployeeFilters;
  onChange: (next: EmployeeFilters) => void;
}

/** Headcount by department, position or employment type. Clicking a count filters the list; clicking it again clears that filter. */
export function EmployeeBreakdown({ employees, filters, onChange }: Props) {
  const [view, setView] = useState<BreakdownKey>('department');
  const [expanded, setExpanded] = useState(false);
  const all = useMemo(() => ({
    department: headcountBreakdown(employees, 'department'),
    position: headcountBreakdown(employees, 'position'),
    employment_type: headcountBreakdown(employees, 'employment_type'),
  }), [employees]);

  const current = VIEWS.find((v) => v.key === view)!;
  const buckets = all[view];
  const selected = filters[current.filter];
  const shown = expanded ? buckets : buckets.slice(0, COLLAPSED);
  const distinct = (k: BreakdownKey) => all[k].filter((b) => b.value !== '__none__').length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {VIEWS.map(({ key, label, icon: Icon, filter }) => (
          <Button
            key={key}
            variant={view === key ? 'default' : 'outline'}
            size="sm"
            className="gap-2"
            onClick={() => { setView(key); setExpanded(false); }}
            aria-pressed={view === key}
          >
            <Icon className="w-4 h-4" />
            {label}
            <span className={cn('rounded-full px-2 text-xs font-semibold', view === key ? 'bg-primary-foreground/20' : 'bg-muted')}>
              {distinct(key)}
            </span>
            {filters[filter] !== 'all' && <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-label="filter applied" />}
          </Button>
        ))}
        {selected !== 'all' && (
          <Button variant="ghost" size="sm" className="gap-1 h-8" onClick={() => onChange({ ...filters, [current.filter]: 'all' })}>
            <X className="w-3 h-3" /> Clear {current.label.toLowerCase()} filter
          </Button>
        )}
      </div>

      {buckets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No employees yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {shown.map((b) => {
            const active = selected === b.value;
            return (
              <button
                key={b.value}
                type="button"
                onClick={() => onChange({ ...filters, [current.filter]: active ? 'all' : b.value })}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors',
                  active ? 'border-primary bg-primary/10 text-foreground' : 'hover:bg-muted/60',
                  b.value === '__none__' && 'italic text-muted-foreground',
                )}
                aria-pressed={active}
                title={`Show ${b.count} employee${b.count === 1 ? '' : 's'}: ${b.label}`}
              >
                {b.label}
                <span className={cn('rounded-md px-1.5 text-xs font-semibold tabular-nums', active ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>
                  {b.count.toLocaleString()}
                </span>
              </button>
            );
          })}
          {buckets.length > COLLAPSED && (
            <Button variant="link" size="sm" className="h-8" onClick={() => setExpanded((x) => !x)}>
              {expanded ? 'Show less' : `Show all ${buckets.length}`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
