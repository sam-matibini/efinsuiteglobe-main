import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createJournalEntry } from '@/hooks/useJournalEntryCreation';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

export function PostUnlinkedDonationsButton() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const { formatWithSymbol } = useCurrencyFormatter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);

  // Query unlinked confirmed donations
  const { data: unlinked = [] } = useQuery({
    queryKey: ['unlinked-donations', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('donations')
        .select('id, donation_number, amount, date_received, donor_id, donor:customers!donor_id(id, name)')
        .eq('organization_id', organization.id)
        .eq('status', 'confirmed')
        .is('journal_entry_id', null)
        .order('date_received');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id,
  });

  if (unlinked.length === 0) return null;

  const totalAmount = unlinked.reduce((s, d) => s + d.amount, 0);

  const handlePost = async () => {
    if (!organization?.id) return;
    setPosting(true);
    setTotal(unlinked.length);
    setProgress(0);

    // Fetch accounts once
    const { data: allAccounts } = await supabase
      .from('accounts')
      .select('id, code, name, account_type, is_header, t3010_category')
      .eq('organization_id', organization.id)
      .eq('is_active', true)
      .eq('is_header', false);

    const accounts = allAccounts || [];
    // Determine income account per donor type (individual vs corporate)
    const individualIncomeAccount =
      accounts.find(a => a.code === '4-01-100-0005') ||
      accounts.find(a => a.name.toLowerCase().includes('individual receipted') && a.account_type === 'income') ||
      accounts.find(a => a.t3010_category === 'receipted_gifts' && a.account_type === 'income') ||
      accounts.find(a => a.account_type === 'income');

    const corporateIncomeAccount =
      accounts.find(a => a.code === '4-01-100-0006') ||
      accounts.find(a => a.name.toLowerCase().includes('corporate receipted') && a.account_type === 'income');

    const bankAccount =
      accounts.find(a => a.code === '1-01-101-0001') ||
      accounts.find(a => a.name.toLowerCase().includes('operating bank') && a.account_type === 'asset') ||
      accounts.find(a => a.code === '1-01-100-0001') ||
      accounts.find(a => (a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('cash')) && a.account_type === 'asset');

    if (!individualIncomeAccount || !bankAccount) {
      toast.error('Could not find required GL accounts (income + bank)');
      setPosting(false);
      return;
    }

    // Get max DON-JE reference
    const { data: existingRefs } = await supabase
      .from('journal_entries')
      .select('reference')
      .eq('organization_id', organization.id)
      .like('reference', 'DON-JE-%');

    let maxNum = 0;
    if (existingRefs) {
      for (const entry of existingRefs) {
        const match = entry.reference?.match(/DON-JE-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < unlinked.length; i++) {
      const d = unlinked[i];
      const donor = (d as any).donor as { id: string; name: string } | null;
      const donorName = donor?.name || 'Unknown Donor';
      const isCorporate = /\b(inc|ltd|corp|llc|company|co\.|management|cleaning|enterprise|group)\b/i.test(donorName);
      const targetIncomeAccount = (isCorporate && corporateIncomeAccount) ? corporateIncomeAccount : individualIncomeAccount;

      try {
        // Check if a bank-imported JE already exists for this donation (dedup)
        const { data: existingBankJe } = await supabase
          .from('journal_entry_lines')
          .select('journal_entry_id, journal_entries!inner(id, reference, status, entry_date)')
          .eq('credit', d.amount)
          .eq('account_id', targetIncomeAccount!.id)
          .filter('journal_entries.reference', 'like', 'BANK-%')
          .filter('journal_entries.status', 'eq', 'posted')
          .filter('journal_entries.entry_date', 'eq', d.date_received)
          .limit(1);

        if (existingBankJe && existingBankJe.length > 0) {
          // Link donation to existing bank JE instead of creating duplicate
          await supabase
            .from('donations')
            .update({ journal_entry_id: existingBankJe[0].journal_entry_id })
            .eq('id', d.id);
          successCount++;
        } else {
          // No existing bank JE, create a new DON-JE
          maxNum++;
          const reference = `DON-JE-${String(maxNum).padStart(5, '0')}`;

          const jeId = await createJournalEntry({
            organizationId: organization.id,
            date: d.date_received,
            description: `Donation ${d.donation_number} — ${donorName}`,
            reference,
            journalType: 'manual',
            lines: [
              { account_id: bankAccount.id, debit: d.amount, credit: 0, memo: `Donation ${d.donation_number}`, customer_id: donor?.id || undefined },
              { account_id: targetIncomeAccount!.id, debit: 0, credit: d.amount, memo: `Donation ${d.donation_number}`, customer_id: donor?.id || undefined },
            ],
            status: 'posted',
          });

          await supabase
            .from('donations')
            .update({ journal_entry_id: jeId })
            .eq('id', d.id);
          successCount++;
        }
      } catch (err: any) {
        console.error(`Failed to post ${d.donation_number}:`, err);
        failCount++;
      }

      setProgress(i + 1);
    }

    setPosting(false);
    setConfirmOpen(false);

    queryClient.invalidateQueries({ queryKey: ['donations'] });
    queryClient.invalidateQueries({ queryKey: ['unlinked-donations'] });
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    queryClient.invalidateQueries({ queryKey: ['donation-stats'] });

    if (failCount === 0) {
      toast.success(`Posted ${successCount} donation(s) to the General Ledger`);
    } else {
      toast.warning(`Posted ${successCount}, failed ${failCount} donation(s)`);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
        <Upload className="w-4 h-4 mr-2" />
        Post {unlinked.length} Unlinked to GL
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post Unlinked Donations to GL</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  {unlinked.length} confirmed donation(s) totalling {formatWithSymbol(totalAmount)} have no journal entry and are not reflected in the General Ledger.
                </p>
                <p>
                  This will create a journal entry for each (Debit: Bank, Credit: Donation Income) and link them.
                </p>
                {posting && (
                  <div className="space-y-1 pt-2">
                    <Progress value={(progress / total) * 100} />
                    <p className="text-xs text-muted-foreground">{progress} of {total} processed</p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={posting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePost} disabled={posting}>
              {posting ? `Posting ${progress}/${total}...` : 'Post All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
