import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useTreasuryRails() {
  const qc = useQueryClient();

  const processTaxPayment = useMutation({
    mutationFn: async (input: { tax_payment_id: string; liability_account_id?: string }) => {
      const { data, error } = await supabase.functions.invoke('treasury-pay-tax', { body: input });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax-payments'] });
      qc.invalidateQueries({ queryKey: ['journal-entries'] });
      toast.success('Tax payment initiated');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const processAPBatch = useMutation({
    mutationFn: async (input: { batch_id: string }) => {
      const { data, error } = await supabase.functions.invoke('treasury-pay-ap-batch', { body: input });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['ap-payment-batches'] });
      qc.invalidateQueries({ queryKey: ['ap-payment-batch-items', vars.batch_id] });
      qc.invalidateQueries({ queryKey: ['bills'] });
      qc.invalidateQueries({ queryKey: ['journal-entries'] });
      toast.success('Payment batch processing started');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return { processTaxPayment, processAPBatch };
}
