import { Globe2, Loader2, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWiseReceivingAccounts } from '@/hooks/useWiseReceivingAccounts';

export function WiseInvoicePaymentsCard() {
  const { accounts, isLoading } = useWiseReceivingAccounts();

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-1">
        <Globe2 className="w-5 h-5 inline-block mr-2" />
        Wise Bank Transfers
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Invoices always display the platform's Wise receiving bank details for the invoice currency,
        along with a unique payment reference used to match deposits back to the right invoice. These
        receiving accounts are shared platform-wide and are managed by platform admins.
      </p>

      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">
          Platform receiving accounts by currency
        </p>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading accounts…
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-4 rounded-lg border border-dashed text-sm text-muted-foreground flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              No platform Wise receiving accounts configured yet. Ask a platform admin to add one so
              invoices can display transfer instructions.
            </span>
          </div>
        ) : (
          <div className="border rounded-lg divide-y">
            {accounts.map((a) => (
              <div key={a.id} className="p-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{a.currency}</span>
                  {a.is_active ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {[a.account_holder_name, a.bank_name].filter(Boolean).join(' • ') || '—'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {a.iban ? `IBAN ${a.iban}` : a.account_number ? `Acct ${a.account_number}` : '—'}
                  {a.bic_swift ? ` • SWIFT ${a.bic_swift}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
