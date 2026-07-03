import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProvincialAuthority {
  id: string;
  code: string;
  name: string;
  jurisdiction: string;
  programs: string[];
  website_url: string | null;
}

export function useProvincialAuthorities() {
  const query = useQuery({
    queryKey: ['provincial-tax-authorities'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('provincial_tax_authorities')
        .select('*')
        .order('jurisdiction', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProvincialAuthority[];
    },
  });
  return { authorities: query.data ?? [], isLoading: query.isLoading };
}
