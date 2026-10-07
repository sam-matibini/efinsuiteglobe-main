import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { statementSortSummary, type StatementSortBy, type StatementSortDirection } from '@/lib/reports/statementSort';
import { useStatementSort } from '@/hooks/useStatementSort';

interface StatementSortControlsProps {
  organizationId?: string | null;
  model?: ReturnType<typeof useStatementSort>;
}

function directionChoices(by: StatementSortBy): Array<{ value: StatementSortDirection; label: string }> {
  if (by === 'amount') {
    return [
      { value: 'desc', label: 'High to low' },
      { value: 'asc', label: 'Low to high' },
    ];
  }
  return [
    { value: 'asc', label: 'A to Z' },
    { value: 'desc', label: 'Z to A' },
  ];
}

export function StatementSortControls({ organizationId, model }: StatementSortControlsProps) {
  const owned = useStatementSort(organizationId);
  const sort = model ?? owned;
  const [name, setName] = useState('');
  const [selectedSaved, setSelectedSaved] = useState('');

  const handleSave = () => {
    const result = sort.save(name);
    if (result.error === 'empty') {
      toast.error('Enter a name for this sort.');
      return;
    }
    if (result.error === 'limit') {
      toast.error('Delete a saved sort before adding another.');
      return;
    }
    if (result.saved) {
      setName('');
      toast.success(result.updated ? `Updated “${result.saved.name}”` : `Saved “${result.saved.name}”`);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">Statement line order</p>
        <p className="text-xs text-muted-foreground">
          Sort revenue and expenses by amount or account description. The saved order is used when the Accountant dashboard generates financial statements.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {(['revenue', 'expense'] as const).map((section) => {
          const rule = sort.criteria[section];
          const label = section === 'revenue' ? 'Revenue' : 'Expenses';
          return (
            <div key={section} className="flex items-end gap-2">
              <label className="text-xs text-muted-foreground">
                {label}
                <select
                  aria-label={`Sort ${label.toLowerCase()} by`}
                  className="mt-1 block h-9 rounded-md border bg-background px-2 text-sm text-foreground"
                  value={rule.by}
                  onChange={(event) => {
                    const by = event.target.value as StatementSortBy;
                    sort.updateSection(section, { by, direction: by === 'amount' ? 'desc' : 'asc' });
                  }}
                >
                  <option value="account">Account code</option>
                  <option value="description">Account description</option>
                  <option value="amount">Amount</option>
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                Direction
                <select
                  aria-label={`${label} sort direction`}
                  className="mt-1 block h-9 rounded-md border bg-background px-2 text-sm text-foreground"
                  value={rule.direction}
                  onChange={(event) => sort.updateSection(section, { direction: event.target.value as StatementSortDirection })}
                >
                  {directionChoices(rule.by).map((choice) => (
                    <option key={choice.value} value={choice.value}>{choice.label}</option>
                  ))}
                </select>
              </label>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground" data-testid="statement-sort-summary">{statementSortSummary(sort.criteria)}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name this sort"
          aria-label="Sort name"
          className="h-9 max-w-xs"
          maxLength={48}
        />
        <Button type="button" size="sm" onClick={handleSave}>Save sort</Button>
        {sort.saved.length > 0 && (
          <label className="text-xs text-muted-foreground">
            Saved sorts
            <select
              aria-label="Apply a saved sort"
              className="ml-2 h-9 rounded-md border bg-background px-2 text-sm text-foreground"
              value={selectedSaved}
              onChange={(event) => {
                const item = sort.saved.find((saved) => saved.id === event.target.value);
                if (item) sort.apply(item);
                setSelectedSaved('');
              }}
            >
              <option value="">Apply a saved sort</option>
              {sort.saved.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
        )}
        {sort.saved.map((item) => (
          <Button key={item.id} type="button" variant="ghost" size="sm" onClick={() => sort.remove(item.id)} aria-label={`Delete sort ${item.name}`}>
            Delete {item.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
