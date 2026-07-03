/**
 * Phase 15 — Withholding Tax hooks
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { toast } from 'sonner';
import { DEFAULT_REGIMES } from '@/lib/withholding/seedRegimes';
import { aggregateSlipBoxes } from '@/lib/withholding/calculator';
import type {
  WhtRegime,
  WhtVendorProfile,
  WhtTransaction,
  WhtSlip,
  WhtRemittance,
} from '@/lib/withholding/types';

export function useWhtRegimes() {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['wht-regimes', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wht_regimes' as any)
        .select('*')
        .eq('organization_id', orgId!)
        .order('country_code')
        .order('code');
      if (error) throw error;
      return (data || []) as unknown as WhtRegime[];
    },
  });

  const seedDefaults = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('No organization');
      const rows = DEFAULT_REGIMES.map((r) => ({ ...r, organization_id: orgId }));
      const { error } = await supabase.from('wht_regimes' as any).insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Default withholding regimes loaded');
      qc.invalidateQueries({ queryKey: ['wht-regimes', orgId] });
    },
    onError: (e: Error) => toast.error(`Seed failed: ${e.message}`),
  });

  const upsert = useMutation({
    mutationFn: async (row: Partial<WhtRegime> & { code: string; name: string; country_code: string; authority: string; slip_type: string }) => {
      if (!orgId) throw new Error('No organization');
      const { error } = await supabase.from('wht_regimes' as any).upsert({ ...row, organization_id: orgId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Regime saved');
      qc.invalidateQueries({ queryKey: ['wht-regimes', orgId] });
    },
    onError: (e: Error) => toast.error(`Save failed: ${e.message}`),
  });

  return { ...query, seedDefaults, upsert };
}

export function useWhtVendorProfiles() {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['wht-vendor-profiles', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wht_vendor_profiles' as any)
        .select('*')
        .eq('organization_id', orgId!);
      if (error) throw error;
      return (data || []) as unknown as WhtVendorProfile[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (row: Partial<WhtVendorProfile> & { vendor_id: string }) => {
      if (!orgId) throw new Error('No organization');
      const { error } = await supabase.from('wht_vendor_profiles' as any).upsert(
        { ...row, organization_id: orgId },
        { onConflict: 'organization_id,vendor_id' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Vendor profile saved');
      qc.invalidateQueries({ queryKey: ['wht-vendor-profiles', orgId] });
    },
    onError: (e: Error) => toast.error(`Save failed: ${e.message}`),
  });

  return { ...query, upsert };
}

export function useWhtTransactions(taxYear?: number) {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  const qc = useQueryClient();
  const year = taxYear ?? new Date().getFullYear();

  const query = useQuery({
    queryKey: ['wht-transactions', orgId, year],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wht_transactions' as any)
        .select('*')
        .eq('organization_id', orgId!)
        .eq('tax_year', year)
        .order('transaction_date', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as WhtTransaction[];
    },
  });

  const create = useMutation({
    mutationFn: async (row: Omit<WhtTransaction, 'id' | 'organization_id'>) => {
      if (!orgId) throw new Error('No organization');
      const { error } = await supabase.from('wht_transactions' as any).insert({ ...row, organization_id: orgId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Withholding transaction recorded');
      qc.invalidateQueries({ queryKey: ['wht-transactions', orgId] });
    },
    onError: (e: Error) => toast.error(`Record failed: ${e.message}`),
  });

  return { ...query, create };
}

export function useWhtSlips(taxYear?: number) {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  const qc = useQueryClient();
  const year = taxYear ?? new Date().getFullYear();

  const query = useQuery({
    queryKey: ['wht-slips', orgId, year],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wht_slips' as any)
        .select('*')
        .eq('organization_id', orgId!)
        .eq('tax_year', year)
        .order('slip_type');
      if (error) throw error;
      return (data || []) as unknown as WhtSlip[];
    },
  });

  const generateForYear = useMutation({
    mutationFn: async (params: { year: number; regimes: WhtRegime[] }) => {
      if (!orgId) throw new Error('No organization');
      const { year: yr, regimes } = params;

      // Pull all transactions for the year
      const { data: txs, error: txErr } = await supabase
        .from('wht_transactions' as any)
        .select('*')
        .eq('organization_id', orgId)
        .eq('tax_year', yr)
        .eq('status', 'recorded');
      if (txErr) throw txErr;

      const transactions = (txs || []) as unknown as WhtTransaction[];
      const grouped = new Map<string, WhtTransaction[]>();
      for (const t of transactions) {
        const key = `${t.vendor_id}__${t.regime_id ?? 'none'}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(t);
      }

      const slipsToInsert = [];
      for (const [key, group] of grouped) {
        const [vendorId, regimeId] = key.split('__');
        const regime = regimes.find((r) => r.id === regimeId);
        if (!regime) continue;
        const { boxAmounts, totalPaid, totalWithheld } = aggregateSlipBoxes(
          group.map((g) => ({ gross_amount_cents: g.gross_amount_cents, withheld_amount_cents: g.withheld_amount_cents })),
          regime,
        );
        if (regime.threshold_cents > 0 && totalPaid < regime.threshold_cents) continue;
        slipsToInsert.push({
          organization_id: orgId,
          vendor_id: vendorId,
          regime_id: regime.id,
          tax_year: yr,
          slip_type: regime.slip_type,
          box_amounts: boxAmounts,
          total_paid_cents: totalPaid,
          total_withheld_cents: totalWithheld,
          status: 'draft' as const,
        });
      }

      if (slipsToInsert.length === 0) {
        throw new Error('No transactions met slip thresholds for the selected year');
      }

      // Replace any existing draft slips for this year
      await supabase
        .from('wht_slips' as any)
        .delete()
        .eq('organization_id', orgId)
        .eq('tax_year', yr)
        .eq('status', 'draft');

      const { error: insErr } = await supabase.from('wht_slips' as any).insert(slipsToInsert);
      if (insErr) throw insErr;
      return slipsToInsert.length;
    },
    onSuccess: (count) => {
      toast.success(`Generated ${count} withholding slips`);
      qc.invalidateQueries({ queryKey: ['wht-slips', orgId] });
    },
    onError: (e: Error) => toast.error(`Generation failed: ${e.message}`),
  });

  const issueSlip = useMutation({
    mutationFn: async (slipId: string) => {
      const { error } = await supabase
        .from('wht_slips' as any)
        .update({ status: 'issued', issued_date: new Date().toISOString().split('T')[0] })
        .eq('id', slipId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Slip issued');
      qc.invalidateQueries({ queryKey: ['wht-slips', orgId] });
    },
    onError: (e: Error) => toast.error(`Issue failed: ${e.message}`),
  });

  return { ...query, generateForYear, issueSlip };
}

export function useWhtRemittances() {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['wht-remittances', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wht_remittances' as any)
        .select('*')
        .eq('organization_id', orgId!)
        .order('due_date', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as WhtRemittance[];
    },
  });

  const create = useMutation({
    mutationFn: async (row: Omit<WhtRemittance, 'id' | 'organization_id'>) => {
      if (!orgId) throw new Error('No organization');
      const { error } = await supabase.from('wht_remittances' as any).insert({ ...row, organization_id: orgId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Remittance recorded');
      qc.invalidateQueries({ queryKey: ['wht-remittances', orgId] });
    },
    onError: (e: Error) => toast.error(`Record failed: ${e.message}`),
  });

  return { ...query, create };
}
