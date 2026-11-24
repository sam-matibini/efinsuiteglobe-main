import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { useAuth } from './useAuth';
import { ExistingEmployee, JobSiteRef } from '@/lib/employeeUpload/plan';
import { commitPlan, CommitInput, CommitResult } from '@/lib/employeeUpload/commit';
import { resolveCountryCode } from '@/lib/employeeUpload/schema';

const PAGE = 1000;

export async function sha256(file: File): Promise<string | null> {
  try {
    const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

export function useEmployeeUpload() {
  const { organization } = useCurrentOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  const orgId = organization?.id ?? null;

  const history = useQuery({
    queryKey: ['employee-import-batches', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_import_batches')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  /** Live employees (paged past PostgREST's 1,000-row cap) and active job sites. */
  const loadContext = async (): Promise<{ existing: ExistingEmployee[]; jobSites: JobSiteRef[] }> => {
    if (!orgId) throw new Error('No organization selected');
    const existing: ExistingEmployee[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('employees')
        .select('id, employee_number, email, statutory_profile')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .order('id')
        .range(from, from + PAGE - 1);
      if (error) throw error;
      existing.push(...((data ?? []) as ExistingEmployee[]));
      if (!data || data.length < PAGE) break;
    }
    const { data: sites, error: siteErr } = await supabase
      .from('job_sites' as never)
      .select('id, name, code')
      .eq('organization_id', orgId)
      .eq('is_active', true);
    if (siteErr) throw siteErr;
    return { existing, jobSites: (sites ?? []) as unknown as JobSiteRef[] };
  };

  const commit = useMutation({
    mutationFn: async (input: Omit<CommitInput, 'organizationId' | 'userId'>): Promise<CommitResult> => {
      if (!orgId) throw new Error('No organization selected');
      return commitPlan(supabase, { ...input, organizationId: orgId, userId: user?.id ?? null });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['employee-import-batches'] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      if (res.historyWarning) toast.warning(res.historyWarning);
    },
    onError: (e: Error) => toast.error(`Import stopped: ${e.message}`),
  });

  const rollback = useMutation({
    mutationFn: async ({ batchId, reason }: { batchId: string; reason: string }) => {
      const { error } = await supabase.rpc('rollback_employee_import', { _batch_id: batchId, _reason: reason });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-import-batches'] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Import rolled back');
    },
    onError: (e: Error) => toast.error(`Rollback failed: ${e.message}`),
  });

  return {
    organization,
    orgCountryCode: resolveCountryCode(organization?.country) ?? null,
    orgJurisdiction: organization?.province ?? null,
    history: history.data ?? [],
    isLoadingHistory: history.isLoading,
    loadContext,
    commit,
    rollback,
  };
}
