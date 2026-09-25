import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { toast } from 'sonner';

export interface SoC2ExportScope {
  audit_log: boolean;
  approvals: boolean;
  pad_agreements: boolean;
  reconciliation: boolean;
  fintrac: boolean;
  delegations: boolean;
  webhooks: boolean;
}

export const DEFAULT_SCOPE: SoC2ExportScope = {
  audit_log: true,
  approvals: true,
  pad_agreements: true,
  reconciliation: true,
  fintrac: true,
  delegations: true,
  webhooks: true,
};

export function useComplianceExports() {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;

  const generate = useMutation({
    mutationFn: async (input: { period_start: string; period_end: string; scope: SoC2ExportScope }) => {
      if (!orgId) throw new Error('No organization');
      const { data, error } = await supabase.functions.invoke('soc2-evidence-pack', {
        body: { organization_id: orgId, ...input },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { download_url: string; expires_in: number; path: string };
    },
    onSuccess: (res) => {
      if (res?.download_url) window.open(res.download_url, '_blank', 'noopener,noreferrer');
      toast.success('Evidence pack generated');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return { generate };
}
