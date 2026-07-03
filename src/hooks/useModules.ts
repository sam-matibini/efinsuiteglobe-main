import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

export interface Module {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_core: boolean | null;
  display_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationModule {
  id: string;
  organization_id: string;
  module_id: string;
  is_enabled: boolean | null;
  enabled_at: string | null;
  enabled_by: string | null;
  disabled_at: string | null;
  disabled_by: string | null;
  created_at: string;
  updated_at: string;
  module?: Module;
}

export function useModules() {
  return useQuery({
    queryKey: ['modules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .order('display_order');
      
      if (error) throw error;
      return data as Module[];
    },
  });
}

export function useOrganizationModules(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['organization-modules', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('organization_modules')
        .select(`
          *,
          module:modules(*)
        `)
        .eq('organization_id', organizationId);
      
      if (error) throw error;
      return data as (OrganizationModule & { module: Module })[];
    },
    enabled: !!organizationId,
  });
}

export function useToggleModuleAccess() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      organizationId, 
      moduleId, 
      isEnabled 
    }: { 
      organizationId: string; 
      moduleId: string; 
      isEnabled: boolean;
    }) => {
      // Check if record exists
      const { data: existing } = await supabase
        .from('organization_modules')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('module_id', moduleId)
        .maybeSingle();

      if (existing) {
        // Update existing record
        const updateData: Record<string, unknown> = {
          is_enabled: isEnabled,
          updated_at: new Date().toISOString(),
        };

        if (isEnabled) {
          updateData.enabled_at = new Date().toISOString();
          updateData.enabled_by = user?.id;
          updateData.disabled_at = null;
          updateData.disabled_by = null;
        } else {
          updateData.disabled_at = new Date().toISOString();
          updateData.disabled_by = user?.id;
        }

        const { error } = await supabase
          .from('organization_modules')
          .update(updateData)
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('organization_modules')
          .insert({
            organization_id: organizationId,
            module_id: moduleId,
            is_enabled: isEnabled,
            enabled_at: isEnabled ? new Date().toISOString() : null,
            enabled_by: isEnabled ? user?.id : null,
          });

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['organization-modules', variables.organizationId] });
      toast.success('Module access updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update module access: ${error.message}`);
    },
  });
}

export function useBulkUpdateModuleAccess() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      organizationId, 
      moduleUpdates 
    }: { 
      organizationId: string; 
      moduleUpdates: { moduleId: string; isEnabled: boolean }[];
    }) => {
      for (const update of moduleUpdates) {
        const { data: existing } = await supabase
          .from('organization_modules')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('module_id', update.moduleId)
          .maybeSingle();

        if (existing) {
          const updateData: Record<string, unknown> = {
            is_enabled: update.isEnabled,
            updated_at: new Date().toISOString(),
          };

          if (update.isEnabled) {
            updateData.enabled_at = new Date().toISOString();
            updateData.enabled_by = user?.id;
            updateData.disabled_at = null;
            updateData.disabled_by = null;
          } else {
            updateData.disabled_at = new Date().toISOString();
            updateData.disabled_by = user?.id;
          }

          await supabase
            .from('organization_modules')
            .update(updateData)
            .eq('id', existing.id);
        } else {
          await supabase
            .from('organization_modules')
            .insert({
              organization_id: organizationId,
              module_id: update.moduleId,
              is_enabled: update.isEnabled,
              enabled_at: update.isEnabled ? new Date().toISOString() : null,
              enabled_by: update.isEnabled ? user?.id : null,
            });
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['organization-modules', variables.organizationId] });
      toast.success('Module access updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update modules: ${error.message}`);
    },
  });
}
