import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Types
export type PMStaffRole = 'partner' | 'manager' | 'senior' | 'staff' | 'intern' | 'contractor';

export interface PMEngagementStaff {
  id: string;
  organization_id: string;
  engagement_id: string;
  user_id: string | null;
  profile_id: string | null;
  staff_name: string;
  staff_email: string | null;
  role: PMStaffRole;
  billing_rate: number | null;
  budgeted_hours: number | null;
  actual_hours: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface PMEngagementStaffInput {
  engagement_id: string;
  user_id?: string | null;
  profile_id?: string | null;
  staff_name: string;
  staff_email?: string | null;
  role: PMStaffRole;
  billing_rate?: number | null;
  budgeted_hours?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
}

export const PM_STAFF_ROLES: { value: PMStaffRole; label: string }[] = [
  { value: 'partner', label: 'Partner' },
  { value: 'manager', label: 'Manager' },
  { value: 'senior', label: 'Senior' },
  { value: 'staff', label: 'Staff' },
  { value: 'intern', label: 'Intern' },
  { value: 'contractor', label: 'Contractor' },
];

// Fetch staff for an engagement
export function usePMEngagementStaff(engagementId: string | null) {
  const { currentOrganization } = useOrganizationContext();
  
  return useQuery({
    queryKey: ['pm-engagement-staff', currentOrganization?.id, engagementId],
    queryFn: async () => {
      if (!currentOrganization?.id || !engagementId) return [];
      
      const { data, error } = await supabase
        .from('pm_engagement_staff')
        .select(`
          *,
          profile:profiles(full_name, avatar_url)
        `)
        .eq('organization_id', currentOrganization.id)
        .eq('engagement_id', engagementId)
        .order('role');
      
      if (error) throw error;
      return data as PMEngagementStaff[];
    },
    enabled: !!currentOrganization?.id && !!engagementId,
  });
}

// Fetch all staff across engagements for the organization
export function usePMAllStaff() {
  const { currentOrganization } = useOrganizationContext();
  
  return useQuery({
    queryKey: ['pm-all-staff', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      const { data, error } = await supabase
        .from('pm_engagement_staff')
        .select(`
          *,
          profile:profiles(full_name, avatar_url),
          engagement:pm_engagements(name, engagement_number, client:pm_clients(legal_name))
        `)
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .order('staff_name');
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id,
  });
}

// Create staff assignment
export function useCreatePMEngagementStaff() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (input: PMEngagementStaffInput) => {
      if (!currentOrganization?.id || !user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('pm_engagement_staff')
        .insert({
          ...input,
          organization_id: currentOrganization.id,
          created_by: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pm-engagement-staff'] });
      queryClient.invalidateQueries({ queryKey: ['pm-all-staff'] });
      toast.success('Staff member added to engagement');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add staff: ${error.message}`);
    },
  });
}

// Update staff assignment
export function useUpdatePMEngagementStaff() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<PMEngagementStaffInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('pm_engagement_staff')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pm-engagement-staff'] });
      queryClient.invalidateQueries({ queryKey: ['pm-all-staff'] });
      toast.success('Staff assignment updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update staff: ${error.message}`);
    },
  });
}

// Remove staff from engagement
export function useDeletePMEngagementStaff() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pm_engagement_staff')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pm-engagement-staff'] });
      queryClient.invalidateQueries({ queryKey: ['pm-all-staff'] });
      toast.success('Staff removed from engagement');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove staff: ${error.message}`);
    },
  });
}
