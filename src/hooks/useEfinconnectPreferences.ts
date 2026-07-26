import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useCountryTreasuryConfig } from '@/hooks/useCountryTreasuryConfig';
import type { RailId } from '@/config/countryTreasuryConfig';
import { toast } from 'sonner';

export type EfinconnectSectionKey = 'bills' | 'transfers' | 'payments' | 'governance';

export interface EfinconnectPreferences {
  rails: Partial<Record<RailId, boolean>>;
  sections: Partial<Record<EfinconnectSectionKey, boolean>>;
  taxAuthorities: Record<string, boolean>;
  defaults: {
    fundingAccountId?: string | null;
    approvalWorkflowId?: string | null;
  };
}

const EMPTY: EfinconnectPreferences = {
  rails: {},
  sections: {},
  taxAuthorities: {},
  defaults: {},
};

export function useEfinconnectPreferences() {
  const { organization } = useCurrentOrganization();
  const { config } = useCountryTreasuryConfig();
  const qc = useQueryClient();
  const orgId = organization?.id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ['efinconnect-preferences', orgId],
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: async (): Promise<EfinconnectPreferences> => {
      const { data, error } = await supabase
        .from('organizations')
        .select('efinconnect_preferences')
        .eq('id', orgId!)
        .maybeSingle();
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = (((data as any)?.efinconnect_preferences ?? {}) as Partial<EfinconnectPreferences>);
      return {
        rails: raw.rails ?? {},
        sections: raw.sections ?? {},
        taxAuthorities: raw.taxAuthorities ?? {},
        defaults: raw.defaults ?? {},
      };
    },
  });

  const prefs = data ?? EMPTY;

  // Merge with country defaults: any rail/section/authority is enabled unless
  // explicitly set to false in preferences.
  const resolved = useMemo(() => {
    const railEnabled = (id: RailId) => prefs.rails[id] !== false;
    const sectionEnabled = (id: EfinconnectSectionKey) => prefs.sections[id] !== false;
    const authorityEnabled = (authority: string) => prefs.taxAuthorities[authority] !== false;

    return {
      railEnabled,
      sectionEnabled,
      authorityEnabled,
      filteredSections: {
        bills: config.sections.bills.filter((c) => {
          // Bills cards target tax authorities via URL — filter if URL includes ?authority=X and disabled
          const m = c.to.match(/authority=([^&]+)/);
          if (m && !authorityEnabled(m[1])) return false;
          return true;
        }),
        transfers: config.sections.transfers,
        payments: config.sections.payments,
      },
    };
  }, [prefs, config]);

  const saveMutation = useMutation({
    mutationFn: async (patch: Partial<EfinconnectPreferences>) => {
      if (!orgId) throw new Error('No organization');
      const next: EfinconnectPreferences = {
        rails: { ...prefs.rails, ...(patch.rails ?? {}) },
        sections: { ...prefs.sections, ...(patch.sections ?? {}) },
        taxAuthorities: { ...prefs.taxAuthorities, ...(patch.taxAuthorities ?? {}) },
        defaults: { ...prefs.defaults, ...(patch.defaults ?? {}) },
      };
      const { error } = await supabase
        .from('organizations')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ efinconnect_preferences: next } as any)
        .eq('id', orgId);
      if (error) throw error;
      return next;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['efinconnect-preferences', orgId] });
      toast.success('eFinconnect settings saved');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to save settings'),
  });

  return {
    prefs,
    isLoading,
    save: saveMutation.mutate,
    saving: saveMutation.isPending,
    config,
    ...resolved,
  };
}
