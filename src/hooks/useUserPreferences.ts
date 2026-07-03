import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export interface UserPreferences {
  id: string;
  user_id: string;
  organization_id: string | null;
  date_format: string;
  number_format: string;
  negative_format: string;
  default_report_period: string;
  email_notifications: boolean;
  due_date_reminders: boolean;
  reconciliation_alerts: boolean;
  created_at: string;
  updated_at: string;
}

const defaultPreferences: Omit<UserPreferences, 'id' | 'user_id' | 'organization_id' | 'created_at' | 'updated_at'> = {
  date_format: 'mdy',
  number_format: 'comma',
  negative_format: 'minus',
  default_report_period: 'month',
  email_notifications: true,
  due_date_reminders: true,
  reconciliation_alerts: true,
};

export function useUserPreferences() {
  const { user } = useAuth();
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const preferencesQuery = useQuery({
    queryKey: ['user-preferences', user?.id, organization?.id],
    queryFn: async () => {
      if (!user) return null;

      let query = supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id);
      
      // Handle null organization_id properly
      if (organization?.id) {
        query = query.eq('organization_id', organization.id);
      } else {
        query = query.is('organization_id', null);
      }

      const { data, error } = await query.maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      return data as UserPreferences | null;
    },
    enabled: !!user,
  });

  const savePreferences = useMutation({
    mutationFn: async (prefs: Partial<Omit<UserPreferences, 'id' | 'user_id' | 'organization_id' | 'created_at' | 'updated_at'>>) => {
      if (!user) throw new Error('Not authenticated');

      const existingPrefs = preferencesQuery.data;

      if (existingPrefs) {
        // Update existing
        const { error } = await supabase
          .from('user_preferences')
          .update(prefs)
          .eq('id', existingPrefs.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('user_preferences')
          .insert({
            user_id: user.id,
            organization_id: organization?.id || null,
            ...defaultPreferences,
            ...prefs,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
      toast.success('Preferences saved');
    },
    onError: (error: Error) => {
      toast.error(`Failed to save preferences: ${error.message}`);
    },
  });

  return {
    preferences: preferencesQuery.data || defaultPreferences as UserPreferences,
    isLoading: preferencesQuery.isLoading,
    savePreferences,
    defaultPreferences,
  };
}
