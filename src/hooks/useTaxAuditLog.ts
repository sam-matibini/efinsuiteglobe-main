import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';

export interface TaxAuditEntry {
  id: string;
  organization_id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_value: any;
  after_value: any;
  reason: string | null;
  ip_address: string | null;
  created_at: string;
  actor_name?: string;
}

interface UseTaxAuditLogParams {
  organizationId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  limit?: number;
}

export function useTaxAuditLog({
  organizationId,
  entityType,
  entityId,
  action,
  limit = 200,
}: UseTaxAuditLogParams) {
  return useQuery({
    queryKey: ['tax-audit-log', organizationId, entityType, entityId, action, limit],
    enabled: !!organizationId,
    queryFn: async (): Promise<TaxAuditEntry[]> => {
      if (!organizationId) return [];
      let query = supabase
        .from('tax_audit_log')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (entityType) query = query.eq('entity_type', entityType);
      if (entityId) query = query.eq('entity_id', entityId);
      if (action) query = query.eq('action', action);
      const { data, error } = await query;
      if (error) throw error;

      // Resolve actor names
      const actorIds = Array.from(new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))) as string[];
      let nameMap = new Map<string, string>();
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', actorIds);
        nameMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.full_name || p.email || 'User']));
      }
      return (data ?? []).map((r) => ({
        ...r,
        actor_name: r.actor_id ? nameMap.get(r.actor_id) ?? 'Unknown' : 'System',
      })) as TaxAuditEntry[];
    },
  });
}

export function useLogTaxAuditEvent() {
  const qc = useQueryClient();
  const { organization } = useCurrentOrganization();
  return useMutation({
    mutationFn: async (params: {
      action: string;
      entity_type: string;
      entity_id?: string;
      before_value?: any;
      after_value?: any;
      reason?: string;
    }) => {
      if (!organization?.id) throw new Error('No organization context');
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from('tax_audit_log').insert({
        organization_id: organization.id,
        actor_id: userData.user?.id ?? null,
        action: params.action,
        entity_type: params.entity_type,
        entity_id: params.entity_id ?? null,
        before_value: params.before_value ?? null,
        after_value: params.after_value ?? null,
        reason: params.reason ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax-audit-log'] });
    },
  });
}
