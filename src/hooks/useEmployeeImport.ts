import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import { ValidationResult, ExistingEmployeeIndex } from '@/lib/employeeImport/validate';
import { ParsedFile, computeFileHash } from '@/lib/employeeImport/parser';
import { TEMPLATE_VERSION } from '@/lib/employeeImport/rules';

export function useEmployeeImport() {
  const { organization } = useCurrentOrganization();
  const qc = useQueryClient();

  const historyQuery = useQuery({
    queryKey: ['employee-import-batches', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('employee_import_batches')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!organization?.id,
  });

  const loadExistingIndex = async (): Promise<ExistingEmployeeIndex> => {
    if (!organization?.id) return { byNumber: new Map(), byEmail: new Map() };
    const { data, error } = await supabase
      .from('employees')
      .select('id, employee_number, first_name, last_name, email, date_of_birth')
      .eq('organization_id', organization.id)
      .is('deleted_at', null)
      .limit(5000);
    if (error) throw error;
    const byNumber = new Map<string, ExistingEmployeeIndex['byNumber'] extends Map<string, infer V> ? V : never>();
    const byEmail = new Map<string, string>();
    for (const e of data ?? []) {
      if (e.employee_number) byNumber.set(e.employee_number, e);
      if (e.email) byEmail.set(e.email.toLowerCase(), e.id);
    }
    return { byNumber, byEmail };
  };

  const createBatch = useMutation({
    mutationFn: async (args: {
      parsed: ParsedFile;
      validation: ValidationResult;
      mode: 'create' | 'update' | 'upsert';
      countryCode?: string;
      replaceBlanks: boolean;
      file: File;
    }) => {
      if (!organization?.id) throw new Error('No organization selected');
      const fileHash = await computeFileHash(args.file);
      const { data: batch, error } = await supabase
        .from('employee_import_batches')
        .insert({
          organization_id: organization.id,
          import_mode: args.mode,
          country_code: args.countryCode,
          file_name: args.parsed.fileName,
          file_hash: fileHash,
          file_size_bytes: args.parsed.fileSize,
          template_version: TEMPLATE_VERSION,
          total_rows: args.validation.summary.totalRows,
          status: 'validated',
          replace_blanks: args.replaceBlanks,
          validation_summary: args.validation.summary as unknown as Record<string, unknown>,
        } as never)
        .select()
        .single();
      if (error) throw error;


      const buildRows = (sheet: 'employees' | 'compensation' | 'deductions' | 'payment', rows: ValidationResult['employees']) =>
        rows.map((r) => ({
          batch_id: batch.id,
          sheet,
          row_number: r.rowNumber,
          raw_data: r.raw as unknown as Record<string, unknown>,
          employee_number: r.employeeNumber ?? null,
          match_type: r.matchType,
          is_valid: r.isValid,
          validation_errors: r.errors as unknown as Record<string, unknown>[],
          validation_warnings: r.warnings as unknown as Record<string, unknown>[],
        }));

      const allRows = [
        ...buildRows('employees', args.validation.employees),
        ...buildRows('compensation', args.validation.compensation),
        ...buildRows('deductions', args.validation.deductions),
        ...buildRows('payment', args.validation.payment),
      ];
      if (allRows.length) {
        // insert in chunks of 500
        for (let i = 0; i < allRows.length; i += 500) {
          const chunk = allRows.slice(i, i + 500);
          const { error: rowErr } = await supabase.from('employee_import_rows').insert(chunk);
          if (rowErr) throw rowErr;
        }
      }
      return batch;
    },
    onError: (e: Error) => toast.error(`Failed to prepare import: ${e.message}`),
  });

  const postBatch = useMutation({
    mutationFn: async (batchId: string) => {
      const { data, error } = await supabase.functions.invoke('employee-bulk-import', {
        body: { action: 'post', batchId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-import-batches'] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Import posted successfully');
    },
    onError: (e: Error) => toast.error(`Import failed: ${e.message}`),
  });

  const rollbackBatch = useMutation({
    mutationFn: async ({ batchId, reason }: { batchId: string; reason: string }) => {
      const { error } = await supabase.rpc('rollback_employee_import', { _batch_id: batchId, _reason: reason });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-import-batches'] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Import rolled back');
    },
    onError: (e: Error) => toast.error(`Rollback failed: ${e.message}`),
  });

  return {
    history: historyQuery.data ?? [],
    isLoadingHistory: historyQuery.isLoading,
    loadExistingIndex,
    createBatch,
    postBatch,
    rollbackBatch,
  };
}
