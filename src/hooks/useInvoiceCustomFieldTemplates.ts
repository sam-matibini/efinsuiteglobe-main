import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

export type DocumentType = 'all' | 'invoice' | 'bill_of_sale' | 'receipt' | 'quote';

export interface InvoiceCustomFieldTemplate {
  id: string;
  organization_id: string;
  label: string;
  field_type: 'text' | 'number' | 'date';
  default_value: string | null;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  document_type: DocumentType;
  created_at: string;
  updated_at: string;
}

export interface CreateFieldTemplateInput {
  label: string;
  field_type: 'text' | 'number' | 'date';
  default_value?: string;
  is_required?: boolean;
  sort_order?: number;
  document_type?: DocumentType;
}

export function useInvoiceCustomFieldTemplates() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const queryKey = ['invoice-custom-field-templates', organization?.id];

  const { data: templates = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('invoice_custom_field_templates')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      return data as InvoiceCustomFieldTemplate[];
    },
    enabled: !!organization?.id,
  });

  const createTemplate = useMutation({
    mutationFn: async (input: CreateFieldTemplateInput) => {
      if (!organization?.id) throw new Error('No organization selected');
      
      // Get max sort_order
      const maxOrder = templates.length > 0 
        ? Math.max(...templates.map(t => t.sort_order)) 
        : -1;
      
      const { data, error } = await supabase
        .from('invoice_custom_field_templates')
        .insert([{
          organization_id: organization.id,
          label: input.label,
          field_type: input.field_type,
          default_value: input.default_value || null,
          is_required: input.is_required ?? false,
          sort_order: input.sort_order ?? maxOrder + 1,
          document_type: input.document_type ?? 'all',
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Custom field template added');
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast.error('A field with this label already exists');
      } else {
        toast.error(`Failed to add field: ${error.message}`);
      }
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InvoiceCustomFieldTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('invoice_custom_field_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Custom field template updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update field: ${error.message}`);
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('invoice_custom_field_templates')
        .update({ is_active: false })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Custom field template removed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove field: ${error.message}`);
    },
  });

  const reorderTemplates = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // Update sort_order for each template
      const updates = orderedIds.map((id, index) => 
        supabase
          .from('invoice_custom_field_templates')
          .update({ sort_order: index })
          .eq('id', id)
      );
      
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => {
      toast.error(`Failed to reorder fields: ${error.message}`);
    },
  });

  // Convert templates to the format used by InvoiceCustomFields component
  const getDefaultCustomFields = () => {
    return templates.map(t => ({
      id: crypto.randomUUID(),
      label: t.label,
      value: t.default_value || '',
      type: t.field_type,
    }));
  };

  return {
    templates,
    isLoading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    reorderTemplates,
    getDefaultCustomFields,
  };
}
