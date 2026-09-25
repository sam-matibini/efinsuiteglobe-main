import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useCraAccounts, CraTaxType } from '@/hooks/useCraAccounts';
import { Link } from 'react-router-dom';

interface Props {
  taxType?: CraTaxType;
  value: string;
  onValueChange: (id: string) => void;
}

export function CraAccountSelect({ taxType, value, onValueChange }: Props) {
  const { accounts, isLoading } = useCraAccounts({ taxType });

  if (!isLoading && accounts.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        No CRA program accounts registered{taxType ? ` for ${taxType.replace('_', '/')}` : ''}.{' '}
        <Link to="/banking-payments/cra-accounts" className="text-primary underline">
          Add one
        </Link>
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger><SelectValue placeholder={isLoading ? 'Loading…' : 'Select CRA account'} /></SelectTrigger>
      <SelectContent>
        {accounts.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            <span className="font-mono text-xs mr-2">{a.full_account_number}</span>
            {a.account_name}
            {a.is_default && <Badge className="ml-2" variant="secondary">default</Badge>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
