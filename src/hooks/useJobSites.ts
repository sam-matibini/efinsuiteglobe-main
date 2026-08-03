import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

export interface JobSite {
  id: string;
  organization_id: string;
  name: string;
  code: string | null;
  state_province: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useJobSites(options?: { activeOnly?: boolean }) {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const activeOnly = options?.activeOnly ?? false;

  const query = useQuery({
    queryKey: ['job_sites', organization?.id, { activeOnly }],
    queryFn: async () => {
      if (!organization?.id) return [] as JobSite[];
      let q = supabase
        .from('job_sites' as any)
        .select('*')
        .eq('organization_id', organization.id)
        .order('name');
      if (activeOnly) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as JobSite[];
    },
    enabled: !!organization?.id,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['job_sites', organization?.id] });

  const createSite = useMutation({
    mutationFn: async (input: { name: string; code?: string | null; state_province?: string | null; is_active?: boolean }) => {
      if (!organization?.id) throw new Error('No organization selected');
      const { data, error } = await supabase
        .from('job_sites' as any)
        .insert({
          organization_id: organization.id,
          name: input.name.trim(),
          code: input.code?.trim() || null,
          state_province: input.state_province?.trim() || null,
          is_active: input.is_active ?? true,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as JobSite;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Job site added');
    },
    onError: (e: Error) => toast.error(`Failed to add job site: ${e.message}`),
  });

  const updateSite = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<JobSite> & { id: string }) => {
      const { error } = await supabase
        .from('job_sites' as any)
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Job site updated');
    },
    onError: (e: Error) => toast.error(`Failed to update job site: ${e.message}`),
  });

  const deleteSite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('job_sites' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Job site deleted');
    },
    onError: (e: Error) => toast.error(`Failed to delete job site: ${e.message}`),
  });

  const bulkCreateSites = useMutation({
    mutationFn: async (
      inputs: { name: string; code?: string | null; state_province?: string | null; is_active?: boolean }[],
    ) => {
      if (!organization?.id) throw new Error('No organization selected');
      if (inputs.length === 0) return { inserted: 0 };
      const payload = inputs.map((i) => ({
        organization_id: organization.id,
        name: i.name.trim(),
        code: i.code?.toString().trim() || null,
        state_province: i.state_province?.toString().trim() || null,
        is_active: i.is_active ?? true,
      }));
      const { data, error } = await supabase
        .from('job_sites' as any)
        .insert(payload as any)
        .select();
      if (error) throw error;
      return { inserted: (data ?? []).length };
    },
    onSuccess: (res) => {
      invalidate();
      toast.success(`Imported ${res.inserted} job site${res.inserted === 1 ? '' : 's'}`);
    },
    onError: (e: Error) => toast.error(`Bulk import failed: ${e.message}`),
  });

  return {
    jobSites: query.data ?? [],
    isLoading: query.isLoading,
    createSite,
    updateSite,
    deleteSite,
    bulkCreateSites,
  };
}
