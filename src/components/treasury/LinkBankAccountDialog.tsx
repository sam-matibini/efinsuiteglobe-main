import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  connectedAccountId: string;
}

export function LinkBankAccountDialog({ open, onOpenChange, organizationId, connectedAccountId }: Props) {
  const qc = useQueryClient();
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const bankAccounts = useQuery({
    queryKey: ['bank-accounts-for-link', organizationId],
    enabled: open && !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase.from('bank_accounts').select('id, name, currency').eq('organization_id', organizationId).order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const existing = useQuery({
    queryKey: ['bank-account-stripe-connect', connectedAccountId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_account_stripe_connect' as any)
        .select('*')
        .eq('connected_account_id', connectedAccountId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (existing.data?.bank_account_id) setBankAccountId(existing.data.bank_account_id);
  }, [existing.data]);

  const save = async () => {
    if (!bankAccountId) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('bank_account_stripe_connect' as any).upsert({
        organization_id: organizationId,
        connected_account_id: connectedAccountId,
        bank_account_id: bankAccountId,
        is_default: true,
      }, { onConflict: 'connected_account_id' });
      if (error) throw error;
      toast.success('Bank account linked');
      qc.invalidateQueries({ queryKey: ['bank-account-stripe-connect', connectedAccountId] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Link internal bank account</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Choose the internal bank account that funds platform-to-connected transfers. Settled payouts will post against this account.
          </p>
          <div>
            <Label>Bank account</Label>
            <Select value={bankAccountId} onValueChange={setBankAccountId}>
              <SelectTrigger><SelectValue placeholder="Select bank account…" /></SelectTrigger>
              <SelectContent>
                {(bankAccounts.data ?? []).map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>{b.name} ({b.currency})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!bankAccountId || busy}>{busy ? 'Saving…' : 'Save link'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
