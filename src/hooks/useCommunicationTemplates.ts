import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

export type TemplateChannel = 'email' | 'sms' | 'whatsapp' | 'all';

export interface CommunicationTemplate {
  id: string;
  organization_id: string;
  name: string;
  channel: TemplateChannel;
  subject: string | null;
  body: string;
  category: string | null;
  variables: string[] | null;
  is_default: boolean;
  use_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateInput {
  name: string;
  channel: TemplateChannel;
  subject?: string;
  body: string;
  category?: string;
  variables?: string[];
  is_default?: boolean;
}

export interface UpdateTemplateInput extends Partial<CreateTemplateInput> {
  id: string;
}

export function useCommunicationTemplates(channel?: TemplateChannel) {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading, error } = useQuery({
    queryKey: ['communication-templates', organization?.id, channel],
    queryFn: async () => {
      if (!organization?.id) return [];

      let query = supabase
        .from('communication_templates')
        .select('*')
        .eq('organization_id', organization.id)
        .order('use_count', { ascending: false });

      if (channel && channel !== 'all') {
        query = query.or(`channel.eq.${channel},channel.eq.all`);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map(template => ({
        ...template,
        channel: template.channel as TemplateChannel,
        variables: template.variables || [],
      })) as CommunicationTemplate[];
    },
    enabled: !!organization?.id,
  });

  const createTemplate = useMutation({
    mutationFn: async (input: CreateTemplateInput) => {
      if (!organization?.id) throw new Error('No organization selected');

      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('communication_templates')
        .insert({
          organization_id: organization.id,
          name: input.name,
          channel: input.channel,
          subject: input.subject || null,
          body: input.body,
          category: input.category || null,
          variables: input.variables || [],
          is_default: input.is_default || false,
          created_by: userData.user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communication-templates'] });
      toast.success('Template created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create template: ' + error.message);
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTemplateInput) => {
      const updateData: Record<string, unknown> = {};
      
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.channel !== undefined) updateData.channel = updates.channel;
      if (updates.subject !== undefined) updateData.subject = updates.subject;
      if (updates.body !== undefined) updateData.body = updates.body;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.variables !== undefined) updateData.variables = updates.variables;
      if (updates.is_default !== undefined) updateData.is_default = updates.is_default;

      const { data, error } = await supabase
        .from('communication_templates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communication-templates'] });
      toast.success('Template updated');
    },
    onError: (error) => {
      toast.error('Failed to update template: ' + error.message);
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('communication_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communication-templates'] });
      toast.success('Template deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete template: ' + error.message);
    },
  });

  const incrementUseCount = useMutation({
    mutationFn: async (id: string) => {
      const template = templates.find(t => t.id === id);
      if (!template) return;

      const { error } = await supabase
        .from('communication_templates')
        .update({ use_count: (template.use_count || 0) + 1 })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communication-templates'] });
    },
  });

  return {
    templates,
    isLoading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    incrementUseCount,
  };
}
