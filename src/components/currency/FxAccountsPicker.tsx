import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAccounts } from '@/hooks/useAccounts';
import { useCurrentOrganization } from '@/hooks/useOrganization';

interface Props {
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
  accountType: 'income' | 'expense' | 'equity';
  hint?: string;
  disabled?: boolean;
}

export function FxAccountsPicker({ label, value, onChange, accountType, hint, disabled }: Props) {
  const { organization } = useCurrentOrganization();
  const { data: accounts = [], isLoading } = useAccounts(organization?.id);

  const filtered = accounts.filter(
    (a) => a.is_active && !a.is_header && (a.account_type === accountType || a.account_type === 'income' || a.account_type === 'expense' || a.account_type === 'equity'),
  );

  // Restrict by exact type for cleaner picker
  const exact = accounts.filter((a) => a.is_active && !a.is_header && a.account_type === accountType);
  const list = exact.length > 0 ? exact : filtered;

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <Select value={value || 'none'} onValueChange={(v) => onChange(v === 'none' ? null : v)} disabled={disabled || isLoading}>
        <SelectTrigger>
          <SelectValue placeholder="Select an account" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">— None —</SelectItem>
          {list.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.code} — {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
