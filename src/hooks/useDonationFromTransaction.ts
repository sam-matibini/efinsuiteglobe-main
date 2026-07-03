import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { useNextDonationNumber } from './useDonations';
import { toast } from 'sonner';
import type { DonationType } from '@/types/donations';

interface CreateDonationFromTransactionInput {
  bankTransactionId: string;
  donorId: string;
  amount: number;
  dateReceived: string;
  donationType: DonationType;
  description?: string;
  fundId?: string;
  programId?: string;
  campaignId?: string;
}

/** Check if a bank transaction already has a linked donation */
export function useDonationForTransaction(bankTransactionId?: string) {
  const { organization } = useCurrentOrganization();

  return useQuery({
    queryKey: ['donation-for-transaction', bankTransactionId],
    queryFn: async () => {
      if (!bankTransactionId || !organization?.id) return null;

      const { data, error } = await supabase
        .from('donations')
        .select('id, donation_number, amount, status, receipt_issued')
        .eq('bank_transaction_id', bankTransactionId)
        .eq('organization_id', organization.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!bankTransactionId && !!organization?.id,
  });
}

/** Create a donation record linked to a bank transaction */
export function useCreateDonationFromTransaction() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();
  const { data: nextNumber } = useNextDonationNumber();

  return useMutation({
    mutationFn: async (input: CreateDonationFromTransactionInput) => {
      if (!organization?.id) throw new Error('No organization selected');

      const { data, error } = await supabase
        .from('donations')
        .insert({
          organization_id: organization.id,
          donation_number: nextNumber || 'DON-00001',
          donor_id: input.donorId,
          date_received: input.dateReceived,
          amount: input.amount,
          currency: 'CAD',
          donation_type: input.donationType,
          bank_transaction_id: input.bankTransactionId,
          fund_id: input.fundId || null,
          program_id: input.programId || null,
          campaign_id: input.campaignId || null,
          eligible_amount: input.amount,
          advantage_value: 0,
          notes: input.description || null,
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      queryClient.invalidateQueries({ queryKey: ['donation-for-transaction'] });
      queryClient.invalidateQueries({ queryKey: ['next-donation-number'] });
      toast.success('Donation recorded and linked for CRA receipt tracking');
    },
    onError: (error) => {
      toast.error('Failed to create donation: ' + error.message);
    },
  });
}
