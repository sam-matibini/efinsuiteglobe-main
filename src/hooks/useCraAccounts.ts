import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type CraProgramCode = 'RT' | 'RP' | 'RC';
export type CraTaxType = 'gst_hst' | 'payroll' | 'corporate_tax';

export interface CraProgramAccount {
  id: string;
  organization_id: string;
  account_name: string;
  business_number: string;
  program_code: CraProgramCode;
  reference_number: string;
  full_account_number: string;
  tax_type: CraTaxType;
  status: 'active' | 'inactive';
  is_default: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateCraAccountInput {
  account_name: string;
  business_number: string;
  program_code: CraProgramCode;
  reference_number: string;
  tax_type: CraTaxType;
  is_default?: boolean;
  metadata?: Record<string, unknown>;
}

export const PROGRAM_FOR_TAX: Record<CraTaxType, CraProgramCode> = {
  gst_hst: 'RT',
  payroll: 'RP',
  corporate_tax: 'RC',
};

export const TAX_FOR_PROGRAM: Record<CraProgramCode, CraTaxType> = {
  RT: 'gst_hst',
  RP: 'payroll',
  RC: 'corporate_tax',
};

export function validateCraAccount(bn: string, program: string, ref: string): string | null {
  if (!/^[0-9]{9}$/.test(bn)) return 'Business number must be exactly 9 digits';
  if (!['RT', 'RP', 'RC'].includes(program)) return 'Program must be RT, RP, or RC';
  if (!/^[0-9]{4}$/.test(ref)) return 'Reference must be exactly 4 digits';
  return null;
}

export function formatFullAccountNumber(bn: string, program: string, ref: string): string {
  return `${bn}${program}${ref}`;
}

export function useCraAccounts(opts?: { taxType?: CraTaxType }) {
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['cra-program-accounts', orgId, opts?.taxType ?? 'all'],
    enabled: !!orgId,
    queryFn: async () => {
      let q = supabase
        .from('cra_program_accounts' as never)
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false });
      if (opts?.taxType) q = q.eq('tax_type', opts.taxType);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CraProgramAccount[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: CreateCraAccountInput) => {
      if (!orgId) throw new Error('No organization');
      const err = validateCraAccount(input.business_number, input.program_code, input.reference_number);
      if (err) throw new Error(err);
      if (PROGRAM_FOR_TAX[input.tax_type] !== input.program_code) {
        throw new Error(`Program ${input.program_code} does not match tax type ${input.tax_type}`);
      }
      const { data, error } = await (supabase as any)
        .from('cra_program_accounts')
        .insert({ ...input, organization_id: orgId, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cra-program-accounts'] });
      toast.success('CRA account saved');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<CraProgramAccount> & { id: string }) => {
      const { error } = await (supabase as any).from('cra_program_accounts').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cra-program-accounts'] });
      toast.success('Updated');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('cra_program_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cra-program-accounts'] });
      toast.success('Removed');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return { accounts: query.data ?? [], isLoading: query.isLoading, create, update, remove };
}
