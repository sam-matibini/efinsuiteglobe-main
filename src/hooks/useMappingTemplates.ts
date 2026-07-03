import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import { ColumnMappingAdvanced, DateFormat, NumberFormat } from '@/components/banking/AdvancedMappingEngine';

export interface MappingTemplate {
  id: string;
  organization_id: string;
  name: string;
  statement_type: 'bank' | 'creditcard';
  bank_name: string | null;
  account_name: string | null;
  mappings: ColumnMappingAdvanced[];
  date_format: DateFormat;
  number_format: NumberFormat;
  invert_sign: boolean;
  treat_brackets_as_negative: boolean;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMappingTemplateInput {
  name: string;
  statement_type: 'bank' | 'creditcard';
  bank_name?: string;
  account_name?: string;
  mappings: ColumnMappingAdvanced[];
  date_format: DateFormat;
  number_format: NumberFormat;
  invert_sign: boolean;
  treat_brackets_as_negative: boolean;
  is_default?: boolean;
}

export function useMappingTemplates(statementType?: 'bank' | 'creditcard') {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading, error } = useQuery({
    queryKey: ['mapping-templates', organization?.id, statementType],
    queryFn: async () => {
      if (!organization?.id) return [];

      let query = supabase
        .from('statement_mapping_templates')
        .select('*')
        .eq('organization_id', organization.id)
        .order('name');

      if (statementType) {
        query = query.eq('statement_type', statementType);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Parse mappings from JSONB and cast to proper types
      // Also normalize legacy field names to current schema
      return (data || []).map(template => {
        const rawMappings = Array.isArray(template.mappings) ? template.mappings : [];
        
        // Normalize field names for backward compatibility
        const normalizedMappings = rawMappings.map((m: any) => {
          const targetField = m?.targetField;
          // Convert legacy merchant_name/merchant to payee_payor
          if (targetField === 'merchant_name' || targetField === 'merchant') {
            return { ...m, targetField: 'payee_payor' };
          }
          // Convert posting_date to posted_date for consistency
          if (targetField === 'posting_date') {
            return { ...m, targetField: 'posted_date' };
          }
          return m;
        });

        return {
          id: template.id,
          organization_id: template.organization_id,
          name: template.name,
          statement_type: template.statement_type as 'bank' | 'creditcard',
          bank_name: template.bank_name,
          account_name: template.account_name,
          mappings: normalizedMappings as unknown as ColumnMappingAdvanced[],
          date_format: (template.date_format || 'auto') as DateFormat,
          number_format: (template.number_format || 'standard') as NumberFormat,
          invert_sign: template.invert_sign ?? false,
          treat_brackets_as_negative: template.treat_brackets_as_negative ?? true,
          is_default: template.is_default ?? false,
          created_by: template.created_by,
          created_at: template.created_at,
          updated_at: template.updated_at,
        };
      }) as MappingTemplate[];
    },
    enabled: !!organization?.id,
  });

  const createTemplate = useMutation({
    mutationFn: async (input: CreateMappingTemplateInput) => {
      if (!organization?.id) throw new Error('No organization selected');

      const { data: userData } = await supabase.auth.getUser();

      const insertData = {
        organization_id: organization.id,
        name: input.name,
        statement_type: input.statement_type,
        bank_name: input.bank_name || null,
        account_name: input.account_name || null,
        mappings: JSON.parse(JSON.stringify(input.mappings)),
        date_format: input.date_format,
        number_format: input.number_format,
        invert_sign: input.invert_sign,
        treat_brackets_as_negative: input.treat_brackets_as_negative,
        is_default: input.is_default || false,
        created_by: userData.user?.id || null,
      };

      const { data, error } = await supabase
        .from('statement_mapping_templates')
        .insert(insertData as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mapping-templates'] });
      toast.success('Template saved successfully');
    },
    onError: (error) => {
      toast.error('Failed to save template: ' + error.message);
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MappingTemplate> & { id: string }) => {
      const updateData: Record<string, unknown> = {};
      
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.bank_name !== undefined) updateData.bank_name = updates.bank_name;
      if (updates.account_name !== undefined) updateData.account_name = updates.account_name;
      if (updates.mappings !== undefined) updateData.mappings = updates.mappings as unknown as Record<string, unknown>[];
      if (updates.date_format !== undefined) updateData.date_format = updates.date_format;
      if (updates.number_format !== undefined) updateData.number_format = updates.number_format;
      if (updates.invert_sign !== undefined) updateData.invert_sign = updates.invert_sign;
      if (updates.treat_brackets_as_negative !== undefined) updateData.treat_brackets_as_negative = updates.treat_brackets_as_negative;
      if (updates.is_default !== undefined) updateData.is_default = updates.is_default;

      const { data, error } = await supabase
        .from('statement_mapping_templates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mapping-templates'] });
      toast.success('Template updated');
    },
    onError: (error) => {
      toast.error('Failed to update template: ' + error.message);
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('statement_mapping_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mapping-templates'] });
      toast.success('Template deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete template: ' + error.message);
    },
  });

  const defaultTemplate = templates.find(t => t.is_default);

  return {
    templates,
    isLoading,
    error,
    defaultTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}
