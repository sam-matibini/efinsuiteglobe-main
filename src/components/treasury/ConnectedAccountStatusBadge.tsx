import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, Clock, XCircle } from 'lucide-react';
import type { StripeConnectedAccount } from '@/hooks/useStripeConnectedAccounts';

export function ConnectedAccountStatusBadge({ account }: { account: StripeConnectedAccount }) {
  if (account.disabled_reason) {
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Disabled</Badge>;
  }
  if (account.charges_enabled && account.payouts_enabled) {
    return <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="h-3 w-3" />Active</Badge>;
  }
  const due = (account.requirements as any)?.currently_due ?? [];
  if (Array.isArray(due) && due.length > 0) {
    return <Badge variant="outline" className="gap-1 border-amber-500 text-amber-700"><AlertTriangle className="h-3 w-3" />Action required ({due.length})</Badge>;
  }
  return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
}
