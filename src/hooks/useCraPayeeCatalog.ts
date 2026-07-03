import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CraPayeeCatalogEntry {
  id: string;
  program_code: string;
  payment_type: string;
  display_label: string;
  cra_bill_payee_code: string | null;
  remittance_voucher_form: string | null;
  due_date_rule: Record<string, unknown>;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

export function useCraPayeeCatalog() {
  const query = useQuery({
    queryKey: ['cra-payee-catalog'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('cra_payee_catalog')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CraPayeeCatalogEntry[];
    },
    staleTime: 60 * 60 * 1000, // 1h — reference data
  });

  return { catalog: query.data ?? [], isLoading: query.isLoading, error: query.error };
}
