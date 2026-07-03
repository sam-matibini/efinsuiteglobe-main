import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { toast } from 'sonner';

export interface CommunicationSender {
  id: string;
  organization_id: string;
  communication_identity_id: string | null;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  phone_normalized: string | null;
  avatar_url: string | null;
  is_default: boolean | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSenderInput {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  is_default?: boolean;
}

export interface UpdateSenderInput extends Partial<CreateSenderInput> {
  id: string;
}

export function useCommunicationSenders() {
  const { currentOrganization } = useOrganizationContext();
  const queryClient = useQueryClient();

  const queryKey = ['communication-senders', currentOrganization?.id];

  const { data: senders = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!currentOrganization?.id) return [];

      const { data, error } = await supabase
        .from('communication_senders')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;
      return data as CommunicationSender[];
    },
    enabled: !!currentOrganization?.id,
  });

  const defaultSender = senders.find(s => s.is_default) || senders[0] || null;

  const createSender = useMutation({
    mutationFn: async (input: CreateSenderInput) => {
      if (!currentOrganization?.id) throw new Error('No organization selected');

      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('communication_senders')
        .insert({
          organization_id: currentOrganization.id,
          name: input.name,
          title: input.title || null,
          email: input.email || null,
          phone: input.phone || null,
          avatar_url: input.avatar_url || null,
          is_default: input.is_default || false,
          created_by: userData.user?.id || null,
          updated_by: userData.user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Sender created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create sender: ' + error.message);
    },
  });

  const updateSender = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateSenderInput) => {
      const { data: userData } = await supabase.auth.getUser();

      const updateData: Record<string, unknown> = {
        updated_by: userData.user?.id,
      };

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.email !== undefined) updateData.email = updates.email;
      if (updates.phone !== undefined) updateData.phone = updates.phone;
      if (updates.avatar_url !== undefined) updateData.avatar_url = updates.avatar_url;
      if (updates.is_default !== undefined) updateData.is_default = updates.is_default;

      const { data, error } = await supabase
        .from('communication_senders')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Sender updated');
    },
    onError: (error) => {
      toast.error('Failed to update sender: ' + error.message);
    },
  });

  const deleteSender = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('communication_senders')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Sender removed');
    },
    onError: (error) => {
      toast.error('Failed to remove sender: ' + error.message);
    },
  });

  const setDefaultSender = useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('communication_senders')
        .update({ 
          is_default: true,
          updated_by: userData.user?.id,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Default sender updated');
    },
    onError: (error) => {
      toast.error('Failed to set default sender: ' + error.message);
    },
  });

  return {
    senders,
    defaultSender,
    isLoading,
    error,
    createSender,
    updateSender,
    deleteSender,
    setDefaultSender,
  };
}
