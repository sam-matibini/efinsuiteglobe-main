import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDepartments } from '@/hooks/useDimensions';

interface DivisionSelectProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  allowAll?: boolean;
  /** Hide non-postable divisions (header-only / eliminating buckets). */
  postableOnly?: boolean;
  className?: string;
}

/**
 * Shared dropdown for tagging transactions with a Division (a.k.a. Department).
 * Sources directly from the org's `departments` table.
 */
export function DivisionSelect({
  value,
  onChange,
  placeholder = 'Select division',
  disabled,
  allowAll = false,
  postableOnly = true,
  className,
}: DivisionSelectProps) {
  const { data: departments = [], isLoading } = useDepartments();
  const options = departments.filter((d: any) =>
    d.is_active !== false && (!postableOnly || d.allow_postings !== false),
  );

  return (
    <Select
      value={value ?? (allowAll ? '__all__' : undefined)}
      onValueChange={(v) => onChange(v === '__all__' ? null : v)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowAll && <SelectItem value="__all__">Consolidated (All)</SelectItem>}
        {options.map((d: any) => (
          <SelectItem key={d.id} value={d.id}>
            <span className="font-mono text-xs mr-2">{d.code}</span>
            {d.name}
            {d.is_shared ? <span className="ml-2 text-xs text-muted-foreground">(Shared)</span> : null}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
