import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { NPO_INDUSTRIES, Industry } from '@/types/accounting';
import { toast } from 'sonner';

/**
 * Hook to automatically enable the Donations module for NPO/Charity industries
 * per ASNPO and CRA compliance requirements.
 */
export function useNpoModuleActivation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      organizationId,
      industry,
    }: {
      organizationId: string;
      industry: Industry | string;
    }) => {
      // Check if industry is an NPO-type that needs Donations module
      const isNpoIndustry = NPO_INDUSTRIES.includes(industry as Industry);
      
      if (!isNpoIndustry) {
        return { activated: false, reason: 'Not an NPO industry' };
      }

      // Get the donations module ID
      const { data: donationsModule, error: moduleError } = await supabase
        .from('modules')
        .select('id')
        .eq('code', 'donations')
        .single();

      if (moduleError || !donationsModule) {
        console.error('Could not find donations module:', moduleError);
        return { activated: false, reason: 'Donations module not found' };
      }

      // Check if already enabled
      const { data: existing } = await supabase
        .from('organization_modules')
        .select('id, is_enabled')
        .eq('organization_id', organizationId)
        .eq('module_id', donationsModule.id)
        .maybeSingle();

      if (existing?.is_enabled) {
        return { activated: false, reason: 'Already enabled' };
      }

      // Enable or create the module access
      if (existing) {
        const { error: updateError } = await supabase
          .from('organization_modules')
          .update({
            is_enabled: true,
            enabled_at: new Date().toISOString(),
            enabled_by: user?.id,
            disabled_at: null,
            disabled_by: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('organization_modules')
          .insert({
            organization_id: organizationId,
            module_id: donationsModule.id,
            is_enabled: true,
            enabled_at: new Date().toISOString(),
            enabled_by: user?.id,
          });

        if (insertError) throw insertError;
      }

      return { activated: true, reason: 'Donations module activated for NPO' };
    },
    onSuccess: (result, variables) => {
      if (result.activated) {
        queryClient.invalidateQueries({ queryKey: ['organization-modules', variables.organizationId] });
        toast.success('Donations module enabled for NPO compliance', {
          description: 'CRA-compliant donation receipting is now available.',
        });
      }
    },
    onError: (error: Error) => {
      console.error('Failed to activate NPO module:', error);
      toast.error('Could not enable Donations module automatically');
    },
  });
}

/**
 * Check if an industry requires the Donations module
 */
export function isNpoIndustry(industry: string | undefined): boolean {
  if (!industry) return false;
  return NPO_INDUSTRIES.includes(industry as Industry);
}
