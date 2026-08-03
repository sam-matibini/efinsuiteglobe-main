import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Rail } from '@/hooks/useFundingBankAccounts';
import { Zap, Building2, Wallet, Send, FileText, ScrollText, CreditCard, Globe2 } from 'lucide-react';

interface Props {
  value: Rail;
  onChange: (rail: Rail) => void;
  available: Rail[];
  disabled?: boolean;
}

const RAILS: Array<{ id: Rail; label: string; icon: React.ComponentType<{ className?: string }>; helper: string }> = [
  { id: 'instant', label: 'Instant', icon: Zap, helper: 'Real-time (RTP/Instant Payouts)' },
  { id: 'ach', label: 'ACH', icon: Building2, helper: 'US bank-to-bank, 1-3 days' },
  { id: 'eft', label: 'EFT', icon: Building2, helper: 'Canadian EFT, 2-3 days' },
  { id: 'card', label: 'Credit / Debit Visa', icon: CreditCard, helper: 'Paysafe card payout, 1-2 days' },
  { id: 'wire', label: 'Wire', icon: Send, helper: 'Same-day domestic wire' },
  { id: 'wise_eft', label: 'Wise EFT', icon: Globe2, helper: 'Wise bank transfer, multi-currency' },
  { id: 'wise_etransfer', label: 'Wise e-Transfer', icon: Send, helper: 'Wise email transfer — no bank details needed' },
  { id: 'wallet_stripe', label: 'Stripe Wallet', icon: Wallet, helper: 'Draw from Stripe balance' },
  { id: 'wallet_paddle', label: 'Paddle Wallet', icon: Wallet, helper: 'Draw from Paddle balance' },
  { id: 'wallet_efinmoney', label: 'eFinMoney Wallet', icon: Wallet, helper: 'Pay to employee eFinMoney wallet' },
  { id: 'cheque', label: 'Cheque', icon: ScrollText, helper: 'Printable cheque batch' },
  { id: 'manual', label: 'Manual', icon: FileText, helper: 'Outside the system' },
];

/** Rails that are provider-hosted and don't depend on the funding bank's capabilities. */
export const PROVIDER_RAILS: Rail[] = ['wise_eft', 'wise_etransfer', 'wallet_efinmoney'];

export function RailPicker({ value, onChange, available, disabled }: Props) {
  const set = new Set(available);
  return (
    <div className="space-y-1">
      <Select value={value} onValueChange={(v) => onChange(v as Rail)} disabled={disabled}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {RAILS.map((r) => {
            const ok = set.has(r.id);
            const Icon = r.icon;
            return (
              <SelectItem key={r.id} value={r.id} disabled={!ok}>
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5" />
                  <span>{r.label}</span>
                  {!ok && <Badge variant="outline" className="ml-1 text-[10px]">unavailable</Badge>}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {RAILS.find((r) => r.id === value)?.helper}
      </p>
    </div>
  );
}
