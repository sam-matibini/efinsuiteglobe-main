import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MarketplaceIntegration {
  id: string; slug: string; name: string; description: string; category: string;
  delivery: string; scopes: string[]; config_schema: { fields?: Array<{ key: string; label: string; type: string; required?: boolean }> };
}
export interface OrgInstallation {
  id: string; organization_id: string; integration_id: string; status: string;
  config: Record<string, unknown>; webhook_url: string | null; webhook_secret: string | null;
  last_run_at: string | null; created_at: string;
  marketplace_integrations?: MarketplaceIntegration;
}

export function useMarketplaceCatalog() {
  return useQuery({
    queryKey: ['marketplace_catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_integrations' as any)
        .select('*').eq('enabled', true).order('name');
      if (error) throw error;
      return (data ?? []) as unknown as MarketplaceIntegration[];
    },
  });
}

export function useInstalledIntegrations(orgId?: string) {
  const qc = useQueryClient();

  const installations = useQuery({
    queryKey: ['org_installations', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_integration_installations' as any)
        .select('*, marketplace_integrations(*)')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OrgInstallation[];
    },
  });

  const install = useMutation({
    mutationFn: async (args: { integration_id: string; config?: Record<string, unknown>; webhook_url?: string; webhook_secret?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('org_integration_installations' as any)
        .insert({
          organization_id: orgId!,
          integration_id: args.integration_id,
          config: args.config ?? {},
          webhook_url: args.webhook_url ?? null,
          webhook_secret: args.webhook_secret ?? crypto.randomUUID().replace(/-/g, ''),
          created_by: u.user?.id,
        }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Integration installed');
      qc.invalidateQueries({ queryKey: ['org_installations'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'paused' | 'revoked' }) => {
      const { error } = await supabase
        .from('org_integration_installations' as any)
        .update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org_installations'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('org_integration_installations' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Integration removed');
      qc.invalidateQueries({ queryKey: ['org_installations'] });
    },
  });

  return { installations: installations.data ?? [], isLoading: installations.isLoading, install, setStatus, remove };
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function useIntegrationApiKeys(installationId?: string, orgId?: string) {
  const qc = useQueryClient();
  const keys = useQuery({
    queryKey: ['integration_api_keys', installationId],
    enabled: !!installationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_api_keys' as any)
        .select('*').eq('installation_id', installationId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (label: string) => {
      const prefix = `efk_${crypto.randomUUID().slice(0, 8)}`;
      const secret = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      const key_hash = await sha256(secret);
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('integration_api_keys' as any)
        .insert({
          installation_id: installationId!, organization_id: orgId!,
          key_prefix: prefix, key_hash, label, created_by: u.user?.id,
        }).select().single();
      if (error) throw error;
      return { ...(data as unknown as Record<string, unknown>), plaintext: `${prefix}.${secret}` };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integration_api_keys'] }),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('integration_api_keys' as any)
        .update({ revoked_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integration_api_keys'] }),
  });

  return { keys: (keys.data ?? []) as any[], isLoading: keys.isLoading, create, revoke };
}

export function useIntegrationEventLog(orgId?: string) {
  return useQuery({
    queryKey: ['integration_event_log', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_event_log' as any)
        .select('*').eq('organization_id', orgId!)
        .order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}
