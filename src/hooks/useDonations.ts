import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import type {
  Donation,
  DonationReceipt,
  DonationProgram,
  DonationFund,
  DonationCampaign,
  DonationPledge,
  DonorPreferences,
  CreateDonationInput,
  CreateProgramInput,
  CreateFundInput,
  CreateCampaignInput,
  CreatePledgeInput,
  IssueReceiptInput,
  UpdateDonationInput,
  UpdateProgramInput,
  UpdatePledgeInput,
} from '@/types/donations';

// =====================================================
// DONATIONS
// =====================================================

export function useDonations(filters?: { status?: string; fund_id?: string; program_id?: string; campaign_id?: string }) {
  const { organization } = useCurrentOrganization();
  
  return useQuery({
    queryKey: ['donations', organization?.id, filters],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      let query = supabase
        .from('donations')
        .select(`
          *,
          donor:customers!donor_id(id, name, email, address_line1, city, province, postal_code),
          program:donation_programs!program_id(id, name, code),
          fund:donation_funds!fund_id(id, name, code),
          campaign:donation_campaigns!campaign_id(id, name, code)
        `)
        .eq('organization_id', organization.id)
        .order('date_received', { ascending: false });
      
      if (filters?.status) query = query.eq('status', filters.status as 'draft' | 'confirmed' | 'cancelled' | 'refunded');
      if (filters?.fund_id) query = query.eq('fund_id', filters.fund_id);
      if (filters?.program_id) query = query.eq('program_id', filters.program_id);
      if (filters?.campaign_id) query = query.eq('campaign_id', filters.campaign_id);
      
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Donation[];
    },
    enabled: !!organization?.id,
  });
}

export function useNextDonationNumber() {
  const { organization } = useCurrentOrganization();
  
  return useQuery({
    queryKey: ['next-donation-number', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return 'DON-00001';
      
      const { data } = await supabase
        .from('donations')
        .select('donation_number')
        .eq('organization_id', organization.id)
        .like('donation_number', 'DON-%')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (!data || data.length === 0) return 'DON-00001';
      
      const maxNum = data.reduce((max, row) => {
        const match = row.donation_number.match(/DON-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          return num > max ? num : max;
        }
        return max;
      }, 0);
      
      return `DON-${String(maxNum + 1).padStart(5, '0')}`;
    },
    enabled: !!organization?.id,
    staleTime: 0,
  });
}

export function useCreateDonation() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();
  const { data: nextNumber } = useNextDonationNumber();
  
  return useMutation({
    mutationFn: async (input: CreateDonationInput) => {
      if (!organization?.id) throw new Error('No organization selected');
      
      const eligibleAmount = input.amount - (input.advantage_value || 0);
      
      const { data, error } = await supabase
        .from('donations')
        .insert({
          organization_id: organization.id,
          donation_number: nextNumber || 'DON-00001',
          donor_id: input.donor_id,
          date_received: input.date_received,
          amount: input.amount,
          currency: 'CAD',
          donation_type: input.donation_type,
          program_id: input.program_id || null,
          fund_id: input.fund_id || null,
          campaign_id: input.campaign_id || null,
          pledge_id: input.pledge_id || null,
          eligible_amount: eligibleAmount,
          advantage_value: input.advantage_value || 0,
          advantage_description: input.advantage_description || null,
          notes: input.notes || null,
          memo: input.memo || null,
          status: 'draft',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      queryClient.invalidateQueries({ queryKey: ['next-donation-number'] });
      toast.success('Donation recorded successfully');
    },
    onError: (error) => {
      toast.error('Failed to record donation: ' + error.message);
    },
  });
}

export function useConfirmDonation() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();
  
  return useMutation({
    mutationFn: async (donationId: string) => {
      if (!organization?.id) throw new Error('No organization selected');
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. Fetch the donation with donor info
      const { data: donation, error: fetchErr } = await supabase
        .from('donations')
        .select('*, donor:customers!donor_id(id, name)')
        .eq('id', donationId)
        .single();
      if (fetchErr) throw fetchErr;
      if (donation.status !== 'draft') throw new Error('Only draft donations can be confirmed');
      
      // 2. Update status to confirmed
      const { data, error } = await supabase
        .from('donations')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          confirmed_by: user?.id,
        })
        .eq('id', donationId)
        .select()
        .single();
      if (error) throw error;

      // 3. Auto-post to GL (skip if already has a journal entry, e.g. bank-originated)
      if (!donation.journal_entry_id) {
        try {
          const jeId = await createDonationJournalEntry(
            organization.id,
            donation,
            (donation as any).donor
          );
          // Link the JE back to the donation
          await supabase
            .from('donations')
            .update({ journal_entry_id: jeId })
            .eq('id', donationId);
        } catch (jeErr: any) {
          console.error('Failed to auto-post donation to GL:', jeErr);
          // Don't fail the confirmation — the bulk button can fix it later
          toast.error('Donation confirmed but GL posting failed: ' + jeErr.message);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      queryClient.invalidateQueries({ queryKey: ['donation-funds'] });
      queryClient.invalidateQueries({ queryKey: ['donation-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      toast.success('Donation confirmed & posted to GL');
    },
    onError: (error) => {
      toast.error('Failed to confirm donation: ' + error.message);
    },
  });
}

/**
 * Creates a journal entry for a donation:
 *   Debit: Operating Bank Account (1-01-101-0001 or fallback)
 *   Credit: Individual receipted donations income account (4-01-100-0005 or fallback)
 */
async function createDonationJournalEntry(
  organizationId: string,
  donation: any,
  donor?: { id: string; name: string } | null
): Promise<string> {
  // Import createJournalEntry inline to avoid circular deps at module level
  const { createJournalEntry } = await import('@/hooks/useJournalEntryCreation');

  // Find the income account (donation revenue)
  const { data: allAccounts } = await supabase
    .from('accounts')
    .select('id, code, name, account_type, is_header, t3010_category')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .eq('is_header', false);

  const accounts = allAccounts || [];

  // Determine if donor is corporate (for account selection)
  const donorName = donor?.name || '';
  const isCorporateDonor = /\b(inc|ltd|corp|llc|company|co\.|management|cleaning|enterprise|group)\b/i.test(donorName);

  // Credit account: Individual by default, Corporate only for business donors
  const incomeAccount = isCorporateDonor
    ? (accounts.find(a => a.code === '4-01-100-0006') ||
       accounts.find(a => a.name.toLowerCase().includes('corporate receipted') && a.account_type === 'income'))
    : (accounts.find(a => a.code === '4-01-100-0005') ||
       accounts.find(a => a.name.toLowerCase().includes('individual receipted') && a.account_type === 'income'));
  // Fallback to any income account if neither found
  const finalIncomeAccount = incomeAccount ||
    accounts.find(a => a.t3010_category === 'receipted_gifts' && a.account_type === 'income') ||
    accounts.find(a => a.account_type === 'income');

  // Debit account: Operating Bank Account
  const bankAccount =
    accounts.find(a => a.code === '1-01-101-0001') ||
    accounts.find(a => a.name.toLowerCase().includes('operating bank') && a.account_type === 'asset') ||
    accounts.find(a => a.code === '1-01-100-0001') ||
    accounts.find(a => (a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('cash')) && a.account_type === 'asset');

  if (!finalIncomeAccount) throw new Error('No donation income account found in Chart of Accounts');
  if (!bankAccount) throw new Error('No bank/cash account found in Chart of Accounts');

  // Generate DON-JE reference
  const { data: existingRefs } = await supabase
    .from('journal_entries')
    .select('reference')
    .eq('organization_id', organizationId)
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
  const reference = `DON-JE-${String(maxNum + 1).padStart(5, '0')}`;

  const displayName = donor?.name || 'Unknown Donor';
  const description = `Donation ${donation.donation_number} — ${displayName}`;

  const jeId = await createJournalEntry({
    organizationId,
    date: donation.date_received,
    description,
    reference,
    journalType: 'manual',
    lines: [
      {
        account_id: bankAccount.id,
        debit: donation.amount,
        credit: 0,
        memo: `Donation ${donation.donation_number}`,
        customer_id: donor?.id || null,
      },
      {
        account_id: finalIncomeAccount.id,
        debit: 0,
        credit: donation.amount,
        memo: `Donation ${donation.donation_number}`,
        customer_id: donor?.id || null,
      },
    ],
    status: 'posted',
  });

  return jeId;
}

export function useCancelDonation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ donationId, reason }: { donationId: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('donations')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id,
          cancellation_reason: reason,
        })
        .eq('id', donationId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      toast.success('Donation cancelled');
    },
    onError: (error) => {
      toast.error('Failed to cancel donation: ' + error.message);
    },
  });
}

export function useUpdateDonation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ donationId, updates }: { donationId: string; updates: UpdateDonationInput }) => {
      // Verify donation is still in draft status
      const { data: existing, error: fetchError } = await supabase
        .from('donations')
        .select('status, receipt_issued')
        .eq('id', donationId)
        .single();
      
      if (fetchError) throw fetchError;
      if (existing.status !== 'draft') {
        throw new Error('Only draft donations can be edited (CRA compliance)');
      }
      
      const { data, error } = await supabase
        .from('donations')
        .update(updates)
        .eq('id', donationId)
        .eq('status', 'draft')
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      queryClient.invalidateQueries({ queryKey: ['donation-stats'] });
      toast.success('Donation updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update donation: ' + error.message);
    },
  });
}

export function useDeleteDonation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (donationId: string) => {
      // Verify donation is draft and no receipt issued
      const { data: existing, error: fetchError } = await supabase
        .from('donations')
        .select('status, receipt_issued')
        .eq('id', donationId)
        .single();
      
      if (fetchError) throw fetchError;
      if (existing.status !== 'draft') {
        throw new Error('Only draft donations can be deleted. Confirmed donations must be cancelled.');
      }
      if (existing.receipt_issued) {
        throw new Error('Cannot delete a donation with a receipt issued');
      }
      
      const { error } = await supabase
        .from('donations')
        .delete()
        .eq('id', donationId)
        .eq('status', 'draft');
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      queryClient.invalidateQueries({ queryKey: ['donation-stats'] });
      toast.success('Donation deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete donation: ' + error.message);
    },
  });
}

// =====================================================
// DONATION RECEIPTS
// =====================================================

export function useDonationReceipts(filters?: { status?: string }) {
  const { organization } = useCurrentOrganization();
  
  return useQuery({
    queryKey: ['donation-receipts', organization?.id, filters],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      let query = supabase
        .from('donation_receipts')
        .select('*, items:donation_receipt_items(*)')
        .eq('organization_id', organization.id)
        .order('date_of_issue', { ascending: false });
      
      if (filters?.status) query = query.eq('status', filters.status as 'draft' | 'issued' | 'cancelled' | 'replaced');
      
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DonationReceipt[];
    },
    enabled: !!organization?.id,
  });
}

export function useNextReceiptNumber() {
  const { organization } = useCurrentOrganization();
  
  return useQuery({
    queryKey: ['next-receipt-number', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return 'REC-00001';
      
      const { data } = await supabase
        .from('donation_receipts')
        .select('receipt_number')
        .eq('organization_id', organization.id)
        .like('receipt_number', 'REC-%')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (!data || data.length === 0) return 'REC-00001';
      
      const maxNum = data.reduce((max, row) => {
        const match = row.receipt_number.match(/REC-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          return num > max ? num : max;
        }
        return max;
      }, 0);
      
      return `REC-${String(maxNum + 1).padStart(5, '0')}`;
    },
    enabled: !!organization?.id,
    staleTime: 0,
  });
}

export function useIssueReceipt() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();
  const { data: nextNumber } = useNextReceiptNumber();
  
  return useMutation({
    mutationFn: async (input: IssueReceiptInput) => {
      if (!organization?.id) throw new Error('No organization selected');
      
      // Get donation details
      const { data: donation, error: donationError } = await supabase
        .from('donations')
        .select('*')
        .eq('id', input.donation_id)
        .single();
      
      if (donationError) throw donationError;
      if (donation.status !== 'confirmed') {
        throw new Error('Cannot issue receipt for unconfirmed donation');
      }
      if (donation.receipt_issued) {
        throw new Error('Receipt already issued for this donation');
      }
      // CRA de minimis rule: advantage > 80% of donation = ineligible
      if ((donation.advantage_value || 0) > 0 && ((donation.advantage_value || 0) / donation.amount) > 0.80) {
        throw new Error('Cannot issue receipt: advantage exceeds 80% of donation amount (CRA de minimis rule)');
      }
      
      // Create receipt
      const { data: receipt, error: receiptError } = await supabase
        .from('donation_receipts')
        .insert({
          organization_id: organization.id,
          receipt_number: nextNumber || 'REC-00001',
          donation_id: input.donation_id,
          charity_legal_name: input.charity_legal_name,
          charity_bn: input.charity_bn,
          charity_address: input.charity_address,
          donor_name: input.donor_name,
          donor_address: input.donor_address,
          date_of_donation: donation.date_received,
          date_of_issue: new Date().toISOString().split('T')[0],
          location_issued: input.location_issued || null,
          amount: donation.amount,
          eligible_amount: donation.eligible_amount,
          advantage_value: donation.advantage_value,
          advantage_description: donation.advantage_description,
          status: 'issued',
          signatory_name: input.signatory_name || null,
          signatory_position: input.signatory_position || null,
          is_locked: true,
        })
        .select()
        .single();
      
      if (receiptError) throw receiptError;
      
      // Update donation with receipt reference
      await supabase
        .from('donations')
        .update({
          receipt_issued: true,
          receipt_id: receipt.id,
        })
        .eq('id', input.donation_id);
      
      return receipt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      queryClient.invalidateQueries({ queryKey: ['donation-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['next-receipt-number'] });
      toast.success('CRA-compliant receipt issued successfully');
    },
    onError: (error) => {
      toast.error('Failed to issue receipt: ' + error.message);
    },
  });
}

export function useCancelReceipt() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ receiptId, reason }: { receiptId: string; reason: string }) => {
      // Note: Cancelled receipts must be retained per CRA rules
      // We create a replacement receipt if needed
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('donation_receipts')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id,
          cancellation_reason: reason,
          is_locked: true, // Keep locked for audit trail
        })
        .eq('id', receiptId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donation-receipts'] });
      toast.success('Receipt cancelled (retained for CRA audit)');
    },
    onError: (error) => {
      toast.error('Failed to cancel receipt: ' + error.message);
    },
  });
}

export interface ReissueReceiptInput {
  receiptId: string;
  cancellationReason: string;
  corrections: {
    donor_name?: string;
    donor_address?: string;
    charity_legal_name?: string;
    charity_bn?: string;
    charity_address?: string;
    amount?: number;
    eligible_amount?: number;
    advantage_value?: number;
    advantage_description?: string | null;
    signatory_name?: string | null;
    signatory_position?: string | null;
    location_issued?: string | null;
  };
}

export function useReissueReceipt() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();

  return useMutation({
    mutationFn: async (input: ReissueReceiptInput) => {
      if (!organization?.id) throw new Error('No organization selected');
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Fetch the old receipt with items
      const { data: oldReceipt, error: fetchErr } = await supabase
        .from('donation_receipts')
        .select('*, items:donation_receipt_items(*)')
        .eq('id', input.receiptId)
        .single();
      if (fetchErr) throw fetchErr;
      if (oldReceipt.status !== 'issued') throw new Error('Only issued receipts can be reissued');

      // 2. Get next receipt number
      const { data: allReceipts } = await supabase
        .from('donation_receipts')
        .select('receipt_number')
        .eq('organization_id', organization.id)
        .like('receipt_number', 'REC-%')
        .order('created_at', { ascending: false })
        .limit(200);

      let maxNum = 0;
      if (allReceipts) {
        for (const r of allReceipts) {
          const match = r.receipt_number.match(/REC-(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        }
      }
      const newReceiptNumber = `REC-${String(maxNum + 1).padStart(5, '0')}`;

      // 3. Cancel old receipt
      const { error: cancelErr } = await supabase
        .from('donation_receipts')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id,
          cancellation_reason: input.cancellationReason,
        })
        .eq('id', input.receiptId);
      if (cancelErr) throw cancelErr;

      // 4. Insert new receipt with corrections
      const corrections = input.corrections;
      const { data: newReceipt, error: insertErr } = await supabase
        .from('donation_receipts')
        .insert({
          organization_id: organization.id,
          receipt_number: newReceiptNumber,
          donation_id: oldReceipt.donation_id,
          is_consolidated: oldReceipt.is_consolidated,
          charity_legal_name: corrections.charity_legal_name ?? oldReceipt.charity_legal_name,
          charity_bn: corrections.charity_bn ?? oldReceipt.charity_bn,
          charity_address: corrections.charity_address ?? oldReceipt.charity_address,
          donor_name: corrections.donor_name ?? oldReceipt.donor_name,
          donor_address: corrections.donor_address ?? oldReceipt.donor_address,
          date_of_donation: oldReceipt.date_of_donation,
          date_of_issue: new Date().toISOString().split('T')[0],
          location_issued: corrections.location_issued !== undefined ? corrections.location_issued : oldReceipt.location_issued,
          amount: corrections.amount ?? oldReceipt.amount,
          eligible_amount: corrections.eligible_amount ?? oldReceipt.eligible_amount,
          advantage_value: corrections.advantage_value ?? oldReceipt.advantage_value,
          advantage_description: corrections.advantage_description !== undefined ? corrections.advantage_description : oldReceipt.advantage_description,
          status: 'issued',
          signatory_name: corrections.signatory_name !== undefined ? corrections.signatory_name : oldReceipt.signatory_name,
          signatory_position: corrections.signatory_position !== undefined ? corrections.signatory_position : oldReceipt.signatory_position,
          cra_disclaimer: oldReceipt.cra_disclaimer,
          replaces_receipt_id: oldReceipt.id,
          is_locked: true,
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      // 5. Link old receipt to new
      await supabase
        .from('donation_receipts')
        .update({ replaced_by_receipt_id: newReceipt.id })
        .eq('id', oldReceipt.id);

      // 6. Handle consolidated items
      const items = (oldReceipt as any).items as any[] | undefined;
      if (oldReceipt.is_consolidated && items && items.length > 0) {
        const newItems = items.map((item: any) => ({
          receipt_id: newReceipt.id,
          donation_id: item.donation_id,
          date_received: item.date_received,
          amount: item.amount,
          eligible_amount: item.eligible_amount,
          advantage_value: item.advantage_value,
          donation_type: item.donation_type,
        }));
        await supabase.from('donation_receipt_items').insert(newItems);

        // Update all linked donations
        for (const item of items) {
          await supabase
            .from('donations')
            .update({ receipt_id: newReceipt.id })
            .eq('id', item.donation_id);
        }
      } else if (oldReceipt.donation_id) {
        // Individual receipt - update the donation
        await supabase
          .from('donations')
          .update({ receipt_id: newReceipt.id })
          .eq('id', oldReceipt.donation_id);
      }

      return newReceipt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      queryClient.invalidateQueries({ queryKey: ['donation-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['next-receipt-number'] });
      toast.success('Receipt reissued with corrections');
    },
    onError: (error) => {
      toast.error('Failed to reissue receipt: ' + error.message);
    },
  });
}

// =====================================================
// PROGRAMS
// =====================================================

export function useDonationPrograms() {
  const { organization } = useCurrentOrganization();
  
  return useQuery({
    queryKey: ['donation-programs', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('donation_programs')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as DonationProgram[];
    },
    enabled: !!organization?.id,
  });
}

export function useCreateProgram() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();
  
  return useMutation({
    mutationFn: async (input: CreateProgramInput) => {
      if (!organization?.id) throw new Error('No organization selected');
      
      const { data, error } = await supabase
        .from('donation_programs')
        .insert({
          organization_id: organization.id,
          code: input.code,
          name: input.name,
          description: input.description || null,
          budget: input.budget || 0,
          start_date: input.start_date || null,
          end_date: input.end_date || null,
          gl_revenue_account_id: input.gl_revenue_account_id || null,
          gl_expense_account_id: input.gl_expense_account_id || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donation-programs'] });
      toast.success('Program created');
    },
    onError: (error) => {
      toast.error('Failed to create program: ' + error.message);
    },
  });
}

export function useUpdateProgram() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ programId, updates }: { programId: string; updates: UpdateProgramInput }) => {
      const { data, error } = await supabase
        .from('donation_programs')
        .update(updates)
        .eq('id', programId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donation-programs'] });
      toast.success('Program updated');
    },
    onError: (error) => {
      toast.error('Failed to update program: ' + error.message);
    },
  });
}

export function useDeleteProgram() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (programId: string) => {
      // Soft-delete: set is_active = false
      const { error } = await supabase
        .from('donation_programs')
        .update({ is_active: false })
        .eq('id', programId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donation-programs'] });
      toast.success('Program deactivated');
    },
    onError: (error) => {
      toast.error('Failed to delete program: ' + error.message);
    },
  });
}

// =====================================================
// FUNDS
// =====================================================

export function useDonationFunds() {
  const { organization } = useCurrentOrganization();
  
  return useQuery({
    queryKey: ['donation-funds', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('donation_funds')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as DonationFund[];
    },
    enabled: !!organization?.id,
  });
}

export function useCreateFund() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();
  
  return useMutation({
    mutationFn: async (input: CreateFundInput) => {
      if (!organization?.id) throw new Error('No organization selected');
      
      const { data, error } = await supabase
        .from('donation_funds')
        .insert({
          organization_id: organization.id,
          code: input.code,
          name: input.name,
          description: input.description || null,
          fund_type: input.fund_type,
          restriction_terms: input.restriction_terms || null,
          target_amount: input.target_amount || null,
          gl_account_id: input.gl_account_id || null,
          deferred_revenue_account_id: input.deferred_revenue_account_id || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donation-funds'] });
      toast.success('Fund created');
    },
    onError: (error) => {
      toast.error('Failed to create fund: ' + error.message);
    },
  });
}

// =====================================================
// CAMPAIGNS
// =====================================================

export function useDonationCampaigns() {
  const { organization } = useCurrentOrganization();
  
  return useQuery({
    queryKey: ['donation-campaigns', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('donation_campaigns')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('is_active', true)
        .order('start_date', { ascending: false });
      
      if (error) throw error;
      return data as DonationCampaign[];
    },
    enabled: !!organization?.id,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();
  
  return useMutation({
    mutationFn: async (input: CreateCampaignInput) => {
      if (!organization?.id) throw new Error('No organization selected');
      
      const { data, error } = await supabase
        .from('donation_campaigns')
        .insert({
          organization_id: organization.id,
          code: input.code,
          name: input.name,
          description: input.description || null,
          goal_amount: input.goal_amount || null,
          start_date: input.start_date,
          end_date: input.end_date || null,
          program_id: input.program_id || null,
          fund_id: input.fund_id || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donation-campaigns'] });
      toast.success('Campaign created');
    },
    onError: (error) => {
      toast.error('Failed to create campaign: ' + error.message);
    },
  });
}

// =====================================================
// PLEDGES
// =====================================================

export function useDonationPledges(filters?: { status?: string }) {
  const { organization } = useCurrentOrganization();
  
  return useQuery({
    queryKey: ['donation-pledges', organization?.id, filters],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      let query = supabase
        .from('donation_pledges')
        .select(`
          *,
          donor:customers!donor_id(id, name)
        `)
        .eq('organization_id', organization.id)
        .order('pledge_date', { ascending: false });
      
      if (filters?.status) query = query.eq('status', filters.status as 'pending' | 'partially_fulfilled' | 'fulfilled' | 'cancelled' | 'written_off');
      
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as DonationPledge[];
    },
    enabled: !!organization?.id,
  });
}

export function useNextPledgeNumber() {
  const { organization } = useCurrentOrganization();
  
  return useQuery({
    queryKey: ['next-pledge-number', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return 'PLG-00001';
      
      const { data } = await supabase
        .from('donation_pledges')
        .select('pledge_number')
        .eq('organization_id', organization.id)
        .like('pledge_number', 'PLG-%')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (!data || data.length === 0) return 'PLG-00001';
      
      const maxNum = data.reduce((max, row) => {
        const match = row.pledge_number.match(/PLG-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          return num > max ? num : max;
        }
        return max;
      }, 0);
      
      return `PLG-${String(maxNum + 1).padStart(5, '0')}`;
    },
    enabled: !!organization?.id,
    staleTime: 0,
  });
}

export function useCreatePledge() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();
  const { data: nextNumber } = useNextPledgeNumber();
  
  return useMutation({
    mutationFn: async (input: CreatePledgeInput) => {
      if (!organization?.id) throw new Error('No organization selected');
      
      const { data, error } = await supabase
        .from('donation_pledges')
        .insert({
          organization_id: organization.id,
          pledge_number: nextNumber || 'PLG-00001',
          donor_id: input.donor_id,
          pledge_date: input.pledge_date,
          total_amount: input.total_amount,
          currency: 'CAD',
          program_id: input.program_id || null,
          fund_id: input.fund_id || null,
          campaign_id: input.campaign_id || null,
          payment_frequency: input.payment_frequency || null,
          expected_start_date: input.expected_start_date || null,
          expected_end_date: input.expected_end_date || null,
          notes: input.notes || null,
          status: 'pending',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donation-pledges'] });
      queryClient.invalidateQueries({ queryKey: ['next-pledge-number'] });
      toast.success('Pledge recorded');
    },
    onError: (error) => {
      toast.error('Failed to record pledge: ' + error.message);
    },
  });
}

export function useUpdatePledge() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ pledgeId, updates }: { pledgeId: string; updates: UpdatePledgeInput }) => {
      // Verify pledge is editable
      const { data: existing, error: fetchError } = await supabase
        .from('donation_pledges')
        .select('status')
        .eq('id', pledgeId)
        .single();
      
      if (fetchError) throw fetchError;
      if (existing.status === 'fulfilled' || existing.status === 'cancelled') {
        throw new Error('Fulfilled or cancelled pledges cannot be edited');
      }
      
      const { data, error } = await supabase
        .from('donation_pledges')
        .update(updates)
        .eq('id', pledgeId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donation-pledges'] });
      toast.success('Pledge updated');
    },
    onError: (error) => {
      toast.error('Failed to update pledge: ' + error.message);
    },
  });
}

export function useDeletePledge() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (pledgeId: string) => {
      // Verify pledge is pending with zero fulfilled amount
      const { data: existing, error: fetchError } = await supabase
        .from('donation_pledges')
        .select('status, fulfilled_amount')
        .eq('id', pledgeId)
        .single();
      
      if (fetchError) throw fetchError;
      if (existing.status !== 'pending') {
        throw new Error('Only pending pledges can be deleted');
      }
      if (existing.fulfilled_amount > 0) {
        throw new Error('Cannot delete a pledge with donations applied');
      }
      
      const { error } = await supabase
        .from('donation_pledges')
        .delete()
        .eq('id', pledgeId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donation-pledges'] });
      toast.success('Pledge deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete pledge: ' + error.message);
    },
  });
}

export function useCancelPledge() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (pledgeId: string) => {
      const { data, error } = await supabase
        .from('donation_pledges')
        .update({ status: 'cancelled' })
        .eq('id', pledgeId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donation-pledges'] });
      toast.success('Pledge cancelled');
    },
    onError: (error) => {
      toast.error('Failed to cancel pledge: ' + error.message);
    },
  });
}

// =====================================================
// DONOR PREFERENCES
// =====================================================

export function useDonorPreferences(customerId: string) {
  return useQuery({
    queryKey: ['donor-preferences', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('donor_preferences')
        .select('*')
        .eq('customer_id', customerId)
        .maybeSingle();
      
      if (error) throw error;
      return data as DonorPreferences | null;
    },
    enabled: !!customerId,
  });
}

export function useUpdateDonorPreferences() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ customerId, ...updates }: Partial<DonorPreferences> & { customerId: string }) => {
      const { data: existing } = await supabase
        .from('donor_preferences')
        .select('id')
        .eq('customer_id', customerId)
        .maybeSingle();
      
      if (existing) {
        const { data, error } = await supabase
          .from('donor_preferences')
          .update(updates)
          .eq('customer_id', customerId)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('donor_preferences')
          .insert({ customer_id: customerId, ...updates })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['donor-preferences', variables.customerId] });
      toast.success('Donor preferences updated');
    },
    onError: (error) => {
      toast.error('Failed to update preferences: ' + error.message);
    },
  });
}

// =====================================================
// DONATION STATISTICS
// =====================================================

export function useDonationStats() {
  const { organization } = useCurrentOrganization();
  
  return useQuery({
    queryKey: ['donation-stats', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;
      
      // Get all confirmed donations (no year filter)
      const { data: donations } = await supabase
        .from('donations')
        .select('amount, eligible_amount')
        .eq('organization_id', organization.id)
        .eq('status', 'confirmed');
      
      // Get all receipts issued
      const { count: receiptsIssued } = await supabase
        .from('donation_receipts')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .eq('status', 'issued');
      
      // Get pending pledges
      const { data: pledges } = await supabase
        .from('donation_pledges')
        .select('remaining_amount')
        .eq('organization_id', organization.id)
        .in('status', ['pending', 'partially_fulfilled']);
      
      const totalDonations = donations?.reduce((sum, d) => sum + d.amount, 0) || 0;
      const totalEligible = donations?.reduce((sum, d) => sum + d.eligible_amount, 0) || 0;
      const donationCount = donations?.length || 0;
      const pendingPledges = pledges?.reduce((sum, p) => sum + (p.remaining_amount || 0), 0) || 0;
      
      return {
        totalDonations,
        totalEligible,
        donationCount,
        receiptsIssued: receiptsIssued || 0,
        pendingPledges,
        averageDonation: donationCount > 0 ? totalDonations / donationCount : 0,
      };
    },
    enabled: !!organization?.id,
  });
}

// =====================================================
// BULK CANCEL RECEIPTS
// =====================================================

export function useBulkCancelReceipts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      receiptIds,
      reason,
      onProgress,
    }: {
      receiptIds: string[];
      reason: string;
      onProgress?: (completed: number, total: number) => void;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const results: { id: string; success: boolean; error?: string }[] = [];

      for (let i = 0; i < receiptIds.length; i++) {
        try {
          const { error } = await supabase
            .from('donation_receipts')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              cancelled_by: user?.id,
              cancellation_reason: reason,
              is_locked: true,
            })
            .eq('id', receiptIds[i])
            .eq('status', 'issued');

          if (error) throw error;
          results.push({ id: receiptIds[i], success: true });
        } catch (err: any) {
          results.push({ id: receiptIds[i], success: false, error: err.message });
        }
        onProgress?.(i + 1, receiptIds.length);
      }

      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        throw new Error(`${failed.length} of ${receiptIds.length} receipts failed to cancel`);
      }
      return results;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['donation-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      toast.success(`${vars.receiptIds.length} receipt(s) cancelled`);
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ['donation-receipts'] });
      toast.error(error.message);
    },
  });
}

// =====================================================
// BULK REISSUE RECEIPTS
// =====================================================

export function useBulkReissueReceipts() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();

  return useMutation({
    mutationFn: async ({
      receiptIds,
      cancellationReason,
      corrections,
      onProgress,
    }: {
      receiptIds: string[];
      cancellationReason: string;
      corrections: ReissueReceiptInput['corrections'];
      onProgress?: (completed: number, total: number) => void;
    }) => {
      if (!organization?.id) throw new Error('No organization selected');
      const { data: { user } } = await supabase.auth.getUser();

      // Get current max receipt number
      const { data: allReceipts } = await supabase
        .from('donation_receipts')
        .select('receipt_number')
        .eq('organization_id', organization.id)
        .like('receipt_number', 'REC-%')
        .order('created_at', { ascending: false })
        .limit(500);

      let maxNum = 0;
      if (allReceipts) {
        for (const r of allReceipts) {
          const match = r.receipt_number.match(/REC-(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        }
      }

      const results: { id: string; success: boolean; newReceiptId?: string; error?: string }[] = [];

      for (let i = 0; i < receiptIds.length; i++) {
        try {
          // 1. Fetch old receipt with items
          const { data: oldReceipt, error: fetchErr } = await supabase
            .from('donation_receipts')
            .select('*, items:donation_receipt_items(*)')
            .eq('id', receiptIds[i])
            .single();
          if (fetchErr) throw fetchErr;
          if (oldReceipt.status !== 'issued') throw new Error('Receipt is not issued');

          // 2. Next number
          maxNum++;
          const newReceiptNumber = `REC-${String(maxNum).padStart(5, '0')}`;

          // 3. Cancel old
          const { error: cancelErr } = await supabase
            .from('donation_receipts')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              cancelled_by: user?.id,
              cancellation_reason: cancellationReason,
            })
            .eq('id', receiptIds[i]);
          if (cancelErr) throw cancelErr;

          // 4. Insert new with corrections (only apply non-undefined corrections)
          const c = corrections;
          const { data: newReceipt, error: insertErr } = await supabase
            .from('donation_receipts')
            .insert({
              organization_id: organization.id,
              receipt_number: newReceiptNumber,
              donation_id: oldReceipt.donation_id,
              is_consolidated: oldReceipt.is_consolidated,
              charity_legal_name: c.charity_legal_name ?? oldReceipt.charity_legal_name,
              charity_bn: c.charity_bn ?? oldReceipt.charity_bn,
              charity_address: c.charity_address ?? oldReceipt.charity_address,
              donor_name: c.donor_name ?? oldReceipt.donor_name,
              donor_address: c.donor_address ?? oldReceipt.donor_address,
              date_of_donation: oldReceipt.date_of_donation,
              date_of_issue: new Date().toISOString().split('T')[0],
              location_issued: c.location_issued !== undefined ? c.location_issued : oldReceipt.location_issued,
              amount: c.amount ?? oldReceipt.amount,
              eligible_amount: c.eligible_amount ?? oldReceipt.eligible_amount,
              advantage_value: c.advantage_value ?? oldReceipt.advantage_value,
              advantage_description: c.advantage_description !== undefined ? c.advantage_description : oldReceipt.advantage_description,
              status: 'issued',
              signatory_name: c.signatory_name !== undefined ? c.signatory_name : oldReceipt.signatory_name,
              signatory_position: c.signatory_position !== undefined ? c.signatory_position : oldReceipt.signatory_position,
              cra_disclaimer: oldReceipt.cra_disclaimer,
              replaces_receipt_id: oldReceipt.id,
              is_locked: true,
            })
            .select()
            .single();
          if (insertErr) throw insertErr;

          // 5. Link old to new
          await supabase
            .from('donation_receipts')
            .update({ replaced_by_receipt_id: newReceipt.id })
            .eq('id', oldReceipt.id);

          // 6. Handle consolidated items
          const items = (oldReceipt as any).items as any[] | undefined;
          if (oldReceipt.is_consolidated && items && items.length > 0) {
            const newItems = items.map((item: any) => ({
              receipt_id: newReceipt.id,
              donation_id: item.donation_id,
              date_received: item.date_received,
              amount: item.amount,
              eligible_amount: item.eligible_amount,
              advantage_value: item.advantage_value,
              donation_type: item.donation_type,
            }));
            await supabase.from('donation_receipt_items').insert(newItems);
            for (const item of items) {
              await supabase
                .from('donations')
                .update({ receipt_id: newReceipt.id })
                .eq('id', item.donation_id);
            }
          } else if (oldReceipt.donation_id) {
            await supabase
              .from('donations')
              .update({ receipt_id: newReceipt.id })
              .eq('id', oldReceipt.donation_id);
          }

          results.push({ id: receiptIds[i], success: true, newReceiptId: newReceipt.id });
        } catch (err: any) {
          results.push({ id: receiptIds[i], success: false, error: err.message });
        }
        onProgress?.(i + 1, receiptIds.length);
      }

      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        throw new Error(`${failed.length} of ${receiptIds.length} receipts failed to reissue`);
      }
      return results;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      queryClient.invalidateQueries({ queryKey: ['donation-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['next-receipt-number'] });
      toast.success(`${vars.receiptIds.length} receipt(s) reissued with corrections`);
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ['donation-receipts'] });
      toast.error(error.message);
    },
  });
}
