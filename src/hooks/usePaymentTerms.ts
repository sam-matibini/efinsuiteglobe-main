import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

export interface PaymentTerm {
  id: string;
  organization_id: string | null;
  name: string;
  days_until_due: number;
  early_payment_discount_percent: number | null;
  early_payment_days: number | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentTermInput {
  name: string;
  days_until_due: number;
  early_payment_discount_percent?: number;
  early_payment_days?: number;
  is_default?: boolean;
}

// Default payment terms
const DEFAULT_PAYMENT_TERMS = [
  { name: 'Due on Receipt', days_until_due: 0 },
  { name: 'Net 7', days_until_due: 7 },
  { name: 'Net 15', days_until_due: 15 },
  { name: 'Net 30', days_until_due: 30, is_default: true },
  { name: 'Net 45', days_until_due: 45 },
  { name: 'Net 60', days_until_due: 60 },
  { name: 'Net 90', days_until_due: 90 },
  { name: '2/10 Net 30', days_until_due: 30, early_payment_discount_percent: 2, early_payment_days: 10 },
  { name: '1/15 Net 30', days_until_due: 30, early_payment_discount_percent: 1, early_payment_days: 15 },
];

export function usePaymentTerms() {
  const { organization: currentOrganization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const paymentTermsQuery = useQuery({
    queryKey: ['payment_terms', currentOrganization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_terms')
        .select('*')
        .eq('organization_id', currentOrganization!.id)
        .eq('is_active', true)
        .order('days_until_due');
      
      if (error) throw error;
      return data as PaymentTerm[];
    },
    enabled: !!currentOrganization?.id,
  });

  const createPaymentTerm = useMutation({
    mutationFn: async (input: CreatePaymentTermInput) => {
      // If setting as default, unset any existing default
      if (input.is_default) {
        await supabase
          .from('payment_terms')
          .update({ is_default: false })
          .eq('organization_id', currentOrganization!.id);
      }

      const { data, error } = await supabase
        .from('payment_terms')
        .insert({
          organization_id: currentOrganization!.id,
          name: input.name,
          days_until_due: input.days_until_due,
          early_payment_discount_percent: input.early_payment_discount_percent || 0,
          early_payment_days: input.early_payment_days,
          is_default: input.is_default || false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment_terms'] });
      toast.success('Payment term created');
    },
    onError: (error) => {
      toast.error(`Failed to create payment term: ${error.message}`);
    },
  });

  const updatePaymentTerm = useMutation({
    mutationFn: async ({ id, ...input }: Partial<PaymentTerm> & { id: string }) => {
      // If setting as default, unset any existing default
      if (input.is_default) {
        await supabase
          .from('payment_terms')
          .update({ is_default: false })
          .eq('organization_id', currentOrganization!.id);
      }

      const { error } = await supabase
        .from('payment_terms')
        .update(input)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment_terms'] });
      toast.success('Payment term updated');
    },
    onError: (error) => {
      toast.error(`Failed to update payment term: ${error.message}`);
    },
  });

  const deletePaymentTerm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('payment_terms')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment_terms'] });
      toast.success('Payment term deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete payment term: ${error.message}`);
    },
  });

  const initializeDefaultTerms = useMutation({
    mutationFn: async () => {
      const terms = DEFAULT_PAYMENT_TERMS.map(term => ({
        organization_id: currentOrganization!.id,
        name: term.name,
        days_until_due: term.days_until_due,
        early_payment_discount_percent: term.early_payment_discount_percent || 0,
        early_payment_days: term.early_payment_days || null,
        is_default: term.is_default || false,
      }));

      const { error } = await supabase
        .from('payment_terms')
        .insert(terms);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment_terms'] });
      toast.success('Default payment terms initialized');
    },
    onError: (error) => {
      toast.error(`Failed to initialize payment terms: ${error.message}`);
    },
  });

  const calculateDueDate = (invoiceDate: string, termId?: string): string => {
    const terms = paymentTermsQuery.data || [];
    const term = termId 
      ? terms.find(t => t.id === termId)
      : terms.find(t => t.is_default);
    
    const daysToAdd = term?.days_until_due || 30;
    const date = new Date(invoiceDate);
    date.setDate(date.getDate() + daysToAdd);
    return date.toISOString().split('T')[0];
  };

  const calculateEarlyPaymentDiscount = (total: number, termId?: string): { discountAmount: number; discountDate: string } | null => {
    const terms = paymentTermsQuery.data || [];
    const term = termId 
      ? terms.find(t => t.id === termId)
      : terms.find(t => t.is_default);
    
    if (!term?.early_payment_discount_percent || !term?.early_payment_days) {
      return null;
    }

    const discountDate = new Date();
    discountDate.setDate(discountDate.getDate() + term.early_payment_days);

    return {
      discountAmount: total * (term.early_payment_discount_percent / 100),
      discountDate: discountDate.toISOString().split('T')[0],
    };
  };

  const paymentTerms = paymentTermsQuery.data || [];
  const defaultTerm = paymentTerms.find(t => t.is_default);

  return {
    paymentTerms,
    defaultTerm,
    isLoading: paymentTermsQuery.isLoading,
    error: paymentTermsQuery.error,
    createPaymentTerm,
    updatePaymentTerm,
    deletePaymentTerm,
    initializeDefaultTerms,
    calculateDueDate,
    calculateEarlyPaymentDiscount,
    availableTerms: DEFAULT_PAYMENT_TERMS,
  };
}
