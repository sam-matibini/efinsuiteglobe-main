import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import { 
  ImportBatch, 
  ImportBatchRow, 
  ImportColumnMapping,
  ImportMappingTemplate,
  AccountAlias,
  ImportType,
  PostingMode,
  FxSource,
  ParsedImportRow,
  AccountSuggestion
} from '@/types/import';
import { Json } from '@/integrations/supabase/types';

interface CreateImportBatchInput {
  import_type: ImportType;
  posting_mode: PostingMode;
  fiscal_year: string;
  as_of_date: string;
  period_start?: string;
  period_end?: string;
  base_currency: string;
  source_currency?: string;
  exchange_rate?: number;
  fx_source?: FxSource;
  source_system?: string;
  entity_id?: string;
  country_id?: string;
  original_filename?: string;
  file_hash?: string;
  file_size_bytes?: number;
}

// Helper functions to convert between DB JSON and typed arrays
function parseJsonArray<T>(json: Json | null | undefined): T[] {
  if (!json) return [];
  if (Array.isArray(json)) return json as unknown as T[];
  return [];
}

function toJson<T>(value: T): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function transformDbBatch(data: any): ImportBatch {
  return {
    ...data,
    column_mappings: parseJsonArray<ImportColumnMapping>(data.column_mappings),
    validation_errors: parseJsonArray(data.validation_errors),
    validation_warnings: parseJsonArray(data.validation_warnings),
    journal_entry_ids: data.journal_entry_ids || [],
    reversal_journal_entry_ids: data.reversal_journal_entry_ids || [],
  };
}

function transformDbRow(data: any): ImportBatchRow {
  return {
    ...data,
    raw_data: data.raw_data || {},
    match_suggestions: parseJsonArray<AccountSuggestion>(data.match_suggestions),
    validation_errors: parseJsonArray(data.validation_errors),
    validation_warnings: parseJsonArray(data.validation_warnings),
  };
}

function transformDbTemplate(data: any): ImportMappingTemplate {
  return {
    ...data,
    mappings: parseJsonArray<ImportColumnMapping>(data.mappings),
  };
}

export function useImportBatches() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const { data: batches = [], isLoading, error, refetch } = useQuery({
    queryKey: ['import-batches', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];

      const { data, error } = await supabase
        .from('import_batches')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(transformDbBatch);
    },
    enabled: !!organization?.id,
  });

  const createBatch = useMutation({
    mutationFn: async (input: CreateImportBatchInput) => {
      if (!organization?.id) throw new Error('No organization selected');

      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('import_batches')
        .insert({
          organization_id: organization.id,
          import_type: input.import_type,
          posting_mode: input.posting_mode,
          fiscal_year: input.fiscal_year,
          as_of_date: input.as_of_date,
          period_start: input.period_start,
          period_end: input.period_end,
          base_currency: input.base_currency,
          source_currency: input.source_currency,
          exchange_rate: input.exchange_rate,
          fx_source: input.fx_source,
          source_system: input.source_system,
          entity_id: input.entity_id,
          country_id: input.country_id,
          original_filename: input.original_filename,
          file_hash: input.file_hash,
          file_size_bytes: input.file_size_bytes,
          created_by: userData.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return transformDbBatch(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-batches'] });
    },
    onError: (error) => {
      toast.error('Failed to create import batch: ' + error.message);
    },
  });

  const updateBatch = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ImportBatch> & { id: string }) => {
      // Convert typed arrays to JSON for DB
      const dbUpdates: Record<string, any> = { ...updates };
      if (updates.column_mappings) {
        dbUpdates.column_mappings = toJson(updates.column_mappings);
      }
      if (updates.validation_errors) {
        dbUpdates.validation_errors = toJson(updates.validation_errors);
      }
      if (updates.validation_warnings) {
        dbUpdates.validation_warnings = toJson(updates.validation_warnings);
      }

      const { data, error } = await supabase
        .from('import_batches')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return transformDbBatch(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-batches'] });
    },
    onError: (error) => {
      toast.error('Failed to update import batch: ' + error.message);
    },
  });

  const deleteBatch = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('import_batches')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-batches'] });
      toast.success('Import batch deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete import batch: ' + error.message);
    },
  });

  return {
    batches,
    isLoading,
    error,
    refetch,
    createBatch,
    updateBatch,
    deleteBatch,
  };
}

export function useImportBatchRows(batchId: string | null) {
  const queryClient = useQueryClient();

  const { data: rows = [], isLoading, error, refetch } = useQuery({
    queryKey: ['import-batch-rows', batchId],
    queryFn: async () => {
      if (!batchId) return [];

      const { data, error } = await supabase
        .from('import_batch_rows')
        .select('*')
        .eq('batch_id', batchId)
        .order('row_number');

      if (error) throw error;
      return (data || []).map(transformDbRow);
    },
    enabled: !!batchId,
  });

  const insertRows = useMutation({
    mutationFn: async (rowsData: Array<{
      batch_id: string;
      row_number: number;
      raw_data: Record<string, unknown>;
      account_code?: string | null;
      account_name?: string | null;
      debit_amount?: number;
      credit_amount?: number;
      net_balance?: number;
      currency?: string | null;
      department?: string | null;
      cost_center?: string | null;
      project?: string | null;
      fund?: string | null;
      location?: string | null;
      program?: string | null;
      matched_account_id?: string | null;
      match_type?: string | null;
      match_confidence?: number | null;
      match_suggestions?: AccountSuggestion[];
      is_valid?: boolean;
      validation_errors?: any[];
      validation_warnings?: any[];
    }>) => {
      const dbRows = rowsData.map(row => ({
        batch_id: row.batch_id,
        row_number: row.row_number,
        raw_data: toJson(row.raw_data),
        account_code: row.account_code,
        account_name: row.account_name,
        debit_amount: row.debit_amount || 0,
        credit_amount: row.credit_amount || 0,
        net_balance: row.net_balance || 0,
        currency: row.currency,
        department: row.department,
        cost_center: row.cost_center,
        project: row.project,
        fund: row.fund,
        location: row.location,
        program: row.program,
        matched_account_id: row.matched_account_id,
        match_type: row.match_type,
        match_confidence: row.match_confidence,
        match_suggestions: toJson(row.match_suggestions || []),
        is_valid: row.is_valid ?? true,
        validation_errors: toJson(row.validation_errors || []),
        validation_warnings: toJson(row.validation_warnings || []),
      }));

      const { data, error } = await supabase
        .from('import_batch_rows')
        .insert(dbRows)
        .select();

      if (error) throw error;
      return (data || []).map(transformDbRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-batch-rows', batchId] });
    },
  });

  const updateRow = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ImportBatchRow> & { id: string }) => {
      const dbUpdates: Record<string, any> = { ...updates };
      if (updates.raw_data) {
        dbUpdates.raw_data = toJson(updates.raw_data);
      }
      if (updates.match_suggestions) {
        dbUpdates.match_suggestions = toJson(updates.match_suggestions);
      }
      if (updates.validation_errors) {
        dbUpdates.validation_errors = toJson(updates.validation_errors);
      }
      if (updates.validation_warnings) {
        dbUpdates.validation_warnings = toJson(updates.validation_warnings);
      }

      const { data, error } = await supabase
        .from('import_batch_rows')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return transformDbRow(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-batch-rows', batchId] });
    },
  });

  const deleteRows = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('import_batch_rows')
        .delete()
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-batch-rows', batchId] });
    },
  });

  const clearRows = useMutation({
    mutationFn: async () => {
      if (!batchId) throw new Error('No batch selected');

      const { error } = await supabase
        .from('import_batch_rows')
        .delete()
        .eq('batch_id', batchId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-batch-rows', batchId] });
    },
  });

  return {
    rows,
    isLoading,
    error,
    refetch,
    insertRows,
    updateRow,
    deleteRows,
    clearRows,
  };
}

export function useAccountMatching() {
  const matchAccounts = async (
    rows: ParsedImportRow[],
    accounts: Array<{ 
      id: string; 
      code: string; 
      name: string; 
      account_type: string;
      is_header?: boolean;
      posting_allowed?: boolean | null;
      parent_id?: string | null;
    }>,
    aliases: AccountAlias[]
  ): Promise<Array<{
    batch_id: string;
    row_number: number;
    raw_data: Record<string, unknown>;
    account_code: string | null;
    account_name: string | null;
    debit_amount: number;
    credit_amount: number;
    net_balance: number;
    currency: string | null;
    department: string | null;
    cost_center: string | null;
    project: string | null;
    fund: string | null;
    location: string | null;
    program: string | null;
    matched_account_id: string | null;
    match_type: string | null;
    match_confidence: number | null;
    match_suggestions: AccountSuggestion[];
    is_valid: boolean;
    validation_errors: any[];
    validation_warnings: any[];
  }>> => {
    const matchedRows: Array<{
      batch_id: string;
      row_number: number;
      raw_data: Record<string, unknown>;
      account_code: string | null;
      account_name: string | null;
      debit_amount: number;
      credit_amount: number;
      net_balance: number;
      currency: string | null;
      department: string | null;
      cost_center: string | null;
      project: string | null;
      fund: string | null;
      location: string | null;
      program: string | null;
      matched_account_id: string | null;
      match_type: string | null;
      match_confidence: number | null;
      match_suggestions: AccountSuggestion[];
      is_valid: boolean;
      validation_errors: any[];
      validation_warnings: any[];
    }> = [];

    const isPostable = (a: { is_header?: boolean; posting_allowed?: boolean | null }) =>
      !a.is_header && a.posting_allowed !== false;

    type AccountLike = (typeof accounts)[number];
    const ROOT_PARENT = '__root__';
    const parentKey = (id: string | null | undefined) => id ?? ROOT_PARENT;

    const childrenByParent = new Map<string, AccountLike[]>();
    for (const a of accounts) {
      const key = parentKey(a.parent_id);
      const arr = childrenByParent.get(key) ?? [];
      arr.push(a);
      childrenByParent.set(key, arr);
    }

    for (const arr of childrenByParent.values()) {
      arr.sort((a, b) => a.code.localeCompare(b.code));
    }

    const getPostableDescendants = (startId: string, max: number): AccountLike[] => {
      const out: AccountLike[] = [];
      const visited = new Set<string>();
      const queue: string[] = [startId];

      while (queue.length > 0 && out.length < max) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);

        const children = childrenByParent.get(current) ?? [];
        for (const child of children) {
          if (isPostable(child)) {
            out.push(child);
            if (out.length >= max) break;
          } else {
            queue.push(child.id);
          }
        }
      }

      return out;
    };

    for (const row of rows) {
      const suggestions: AccountSuggestion[] = [];
      let matchedAccountId: string | null = null;
      let matchType: string | null = 'unmatched';
      let matchConfidence = 0;

      const validationErrors: any[] = [...row.errors];
      const validationWarnings: any[] = [...row.warnings];

      const code = row.accountCode?.trim().toLowerCase() || '';
      const name = row.accountName?.trim().toLowerCase() || '';

      const addNonPostableError = (accountName: string) => {
        validationErrors.push({
          code: 'NON_POSTABLE_ACCOUNT',
          field: 'matched_account_id',
          message: `Cannot post to header/non-posting account: ${accountName}. Choose a posting account instead.`,
        });
      };

      // 1. Exact code match
      const exactByCode = accounts.find(a => a.code.toLowerCase() === code);
      if (exactByCode) {
        if (isPostable(exactByCode)) {
          matchedAccountId = exactByCode.id;
          matchType = 'exact';
          matchConfidence = 100;
          suggestions.push({
            account_id: exactByCode.id,
            account_code: exactByCode.code,
            account_name: exactByCode.name,
            account_type: exactByCode.account_type,
            confidence: 100,
            match_reason: 'Exact code match',
          });
        } else {
          const descendants = getPostableDescendants(exactByCode.id, 5);

          if (descendants.length > 0) {
            const firstChild = descendants[0];
            matchedAccountId = firstChild.id;
            matchType = 'exact';
            matchConfidence = 90;

            suggestions.push({
              account_id: firstChild.id,
              account_code: firstChild.code,
              account_name: firstChild.name,
              account_type: firstChild.account_type,
              confidence: 90,
              match_reason: `Auto-selected posting account under header "${exactByCode.name}"`,
            });

            descendants.slice(1, 4).forEach(m => {
              suggestions.push({
                account_id: m.id,
                account_code: m.code,
                account_name: m.name,
                account_type: m.account_type,
                confidence: 70,
                match_reason: 'Posting account under matched header',
              });
            });

            validationWarnings.push({
              code: 'AUTO_SELECTED_CHILD',
              field: 'matched_account_id',
              message: `Header account "${exactByCode.name}" matched. Auto-selected child: ${firstChild.name}`,
            });
          } else {
            suggestions.push({
              account_id: exactByCode.id,
              account_code: exactByCode.code,
              account_name: exactByCode.name,
              account_type: exactByCode.account_type,
              confidence: 100,
              match_reason: 'Exact code match (header/non-posting - no posting descendants)',
            });
            addNonPostableError(exactByCode.name);
          }
        }
      }

      // 2. Alias match
      if (!matchedAccountId) {
        const aliasMatch = aliases.find(a => a.alias_code.toLowerCase() === code && a.is_active);
        if (aliasMatch) {
          const account = accounts.find(a => a.id === aliasMatch.account_id);
          if (account) {
            if (isPostable(account)) {
              matchedAccountId = account.id;
              matchType = 'alias';
              matchConfidence = 95;
              suggestions.push({
                account_id: account.id,
                account_code: account.code,
                account_name: account.name,
                account_type: account.account_type,
                confidence: 95,
                match_reason: `Alias match: ${aliasMatch.alias_code}`,
              });
            } else {
              const descendants = getPostableDescendants(account.id, 5);
              if (descendants.length > 0) {
                const firstChild = descendants[0];
                matchedAccountId = firstChild.id;
                matchType = 'alias';
                matchConfidence = 85;
                suggestions.push({
                  account_id: firstChild.id,
                  account_code: firstChild.code,
                  account_name: firstChild.name,
                  account_type: firstChild.account_type,
                  confidence: 85,
                  match_reason: `Alias matched header "${account.name}"; auto-selected posting child`,
                });

                descendants.slice(1, 4).forEach(m => {
                  suggestions.push({
                    account_id: m.id,
                    account_code: m.code,
                    account_name: m.name,
                    account_type: m.account_type,
                    confidence: 70,
                    match_reason: 'Posting account under matched header',
                  });
                });

                validationWarnings.push({
                  code: 'AUTO_SELECTED_CHILD',
                  field: 'matched_account_id',
                  message: `Alias matched header "${account.name}". Auto-selected child: ${firstChild.name}`,
                });
              } else {
                suggestions.push({
                  account_id: account.id,
                  account_code: account.code,
                  account_name: account.name,
                  account_type: account.account_type,
                  confidence: 95,
                  match_reason: `Alias match to header/non-posting: ${aliasMatch.alias_code}`,
                });
                addNonPostableError(account.name);
              }
            }
          }
        }
      }

      // 3. Fuzzy matching on name (postable accounts only)
      if (!matchedAccountId && name) {
        const fuzzyMatches = accounts
          .filter(a => isPostable(a))
          .map(a => ({
            ...a,
            similarity: calculateSimilarity(name, a.name.toLowerCase()),
          }))
          .filter(a => a.similarity > 0.6)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 3);

        if (fuzzyMatches.length > 0) {
          const best = fuzzyMatches[0];
          if (best.similarity > 0.8) {
            matchedAccountId = best.id;
            matchType = 'fuzzy';
            matchConfidence = Math.round(best.similarity * 100);
          }

          fuzzyMatches.forEach(m => {
            suggestions.push({
              account_id: m.id,
              account_code: m.code,
              account_name: m.name,
              account_type: m.account_type,
              confidence: Math.round(m.similarity * 100),
              match_reason: 'Fuzzy name match',
            });
          });
        }
      }

      // 4. Code prefix matching (postable accounts only)
      if (!matchedAccountId && code) {
        const prefixMatches = accounts
          .filter(a => isPostable(a))
          .filter(a => a.code.toLowerCase().startsWith(code) || code.startsWith(a.code.toLowerCase()))
          .slice(0, 3);

        prefixMatches.forEach(m => {
          if (!suggestions.find(s => s.account_id === m.id)) {
            suggestions.push({
              account_id: m.id,
              account_code: m.code,
              account_name: m.name,
              account_type: m.account_type,
              confidence: 60,
              match_reason: 'Code prefix match',
            });
          }
        });
      }

      matchedRows.push({
        batch_id: '', // Will be set when inserting
        row_number: row.rowNumber,
        raw_data: row.rawData,
        account_code: row.accountCode || null,
        account_name: row.accountName || null,
        debit_amount: row.debit,
        credit_amount: row.credit,
        net_balance: row.balance,
        currency: row.currency || null,
        department: row.department || null,
        cost_center: row.costCenter || null,
        project: row.project || null,
        fund: row.fund || null,
        location: row.location || null,
        program: row.program || null,
        matched_account_id: matchedAccountId,
        match_type: matchType,
        match_confidence: matchConfidence,
        match_suggestions: suggestions,
        is_valid: validationErrors.length === 0,
        validation_errors: validationErrors,
        validation_warnings: validationWarnings,
      });
    }

    return matchedRows;
  };

  return { matchAccounts };
}

export function useAccountAliases() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const { data: aliases = [], isLoading, error } = useQuery({
    queryKey: ['account-aliases', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];

      const { data, error } = await supabase
        .from('account_aliases')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('is_active', true)
        .order('alias_code');

      if (error) throw error;
      return data as AccountAlias[];
    },
    enabled: !!organization?.id,
  });

  const createAlias = useMutation({
    mutationFn: async (input: {
      organization_id: string;
      account_id: string;
      alias_code: string;
      alias_name?: string;
      source_system?: string;
    }) => {
      const { data, error } = await supabase
        .from('account_aliases')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as AccountAlias;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-aliases'] });
      toast.success('Alias created');
    },
    onError: (error) => {
      toast.error('Failed to create alias: ' + error.message);
    },
  });

  return { aliases, isLoading, error, createAlias };
}

export function useImportMappingTemplates(importType?: ImportType) {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading, error } = useQuery({
    queryKey: ['import-mapping-templates', organization?.id, importType],
    queryFn: async () => {
      if (!organization?.id) return [];

      let query = supabase
        .from('import_mapping_templates')
        .select('*')
        .eq('organization_id', organization.id)
        .order('name');

      if (importType) {
        query = query.eq('import_type', importType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []).map(transformDbTemplate);
    },
    enabled: !!organization?.id,
  });

  const createTemplate = useMutation({
    mutationFn: async (input: {
      organization_id: string;
      name: string;
      import_type: ImportType;
      source_system?: string;
      mappings: ImportColumnMapping[];
      date_format?: string;
      number_format?: string;
      invert_signs?: boolean;
      treat_brackets_as_negative?: boolean;
      default_currency?: string;
      default_entity_id?: string;
      is_default?: boolean;
    }) => {
      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('import_mapping_templates')
        .insert({
          organization_id: input.organization_id,
          name: input.name,
          import_type: input.import_type,
          source_system: input.source_system,
          mappings: toJson(input.mappings),
          date_format: input.date_format || 'auto',
          number_format: input.number_format || 'standard',
          invert_signs: input.invert_signs || false,
          treat_brackets_as_negative: input.treat_brackets_as_negative ?? true,
          default_currency: input.default_currency,
          default_entity_id: input.default_entity_id,
          is_default: input.is_default || false,
          created_by: userData.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return transformDbTemplate(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-mapping-templates'] });
      toast.success('Template saved');
    },
    onError: (error) => {
      toast.error('Failed to save template: ' + error.message);
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('import_mapping_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-mapping-templates'] });
      toast.success('Template deleted');
    },
  });

  return { templates, isLoading, error, createTemplate, deleteTemplate };
}

// Utility function for fuzzy matching
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[_\s-]/g, '');
  const s2 = str2.toLowerCase().replace(/[_\s-]/g, '');
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1;
  
  const costs: number[] = [];
  for (let i = 0; i <= shorter.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= longer.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (shorter.charAt(i - 1) !== longer.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[longer.length] = lastValue;
  }
  
  return (longer.length - costs[longer.length]) / longer.length;
}
