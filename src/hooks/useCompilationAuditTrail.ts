import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CompilationReport } from './useCompilationReports';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

export interface AuditTrailEntry {
  id: string;
  compilation_report_id: string;
  action: string;
  action_details: Record<string, unknown> | null;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  performed_by: string | null;
  performed_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

export interface CompilationVersion {
  id: string;
  compilation_report_id: string;
  version_number: number;
  snapshot_data: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
  change_summary: string | null;
  is_locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
}

// Audit Trail Hook
export function useCompilationAuditTrail(compilationReportId: string | undefined) {
  return useQuery({
    queryKey: ['compilation-audit-trail', compilationReportId],
    queryFn: async () => {
      if (!compilationReportId) return [];

      const { data, error } = await supabase
        .from('compilation_audit_trail')
        .select('*')
        .eq('compilation_report_id', compilationReportId)
        .order('performed_at', { ascending: false });

      if (error) throw error;
      return data as AuditTrailEntry[];
    },
    enabled: !!compilationReportId,
  });
}

// Create audit entry
export function useCreateAuditEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: {
      compilation_report_id: string;
      action: string;
      action_details?: Record<string, unknown>;
      field_changed?: string;
      old_value?: string;
      new_value?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('compilation_audit_trail')
        .insert({
          compilation_report_id: entry.compilation_report_id,
          action: entry.action,
          action_details: entry.action_details as Json || null,
          field_changed: entry.field_changed || null,
          old_value: entry.old_value || null,
          new_value: entry.new_value || null,
          performed_by: userData?.user?.id || null,
          user_agent: navigator.userAgent,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['compilation-audit-trail', variables.compilation_report_id] 
      });
    },
  });
}

// Versions Hook
export function useCompilationVersions(compilationReportId: string | undefined) {
  return useQuery({
    queryKey: ['compilation-versions', compilationReportId],
    queryFn: async () => {
      if (!compilationReportId) return [];

      const { data, error } = await supabase
        .from('compilation_report_versions')
        .select('*')
        .eq('compilation_report_id', compilationReportId)
        .order('version_number', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(v => ({
        ...v,
        snapshot_data: v.snapshot_data as Record<string, unknown>
      })) as CompilationVersion[];
    },
    enabled: !!compilationReportId,
  });
}

// Create new version
export function useCreateCompilationVersion() {
  const queryClient = useQueryClient();
  const createAudit = useCreateAuditEntry();

  return useMutation({
    mutationFn: async ({
      compilationReport,
      changeSummary,
    }: {
      compilationReport: CompilationReport;
      changeSummary?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      // Get the current max version number
      const { data: existingVersions } = await supabase
        .from('compilation_report_versions')
        .select('version_number')
        .eq('compilation_report_id', compilationReport.id)
        .order('version_number', { ascending: false })
        .limit(1);

      const nextVersion = (existingVersions?.[0]?.version_number || 0) + 1;

      const { data, error } = await supabase
        .from('compilation_report_versions')
        .insert({
          compilation_report_id: compilationReport.id,
          version_number: nextVersion,
          snapshot_data: compilationReport as unknown as Json,
          created_by: userData?.user?.id || null,
          change_summary: changeSummary || `Version ${nextVersion} created`,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Create audit entry
      await createAudit.mutateAsync({
        compilation_report_id: compilationReport.id,
        action: 'version_created',
        action_details: { version_number: nextVersion, change_summary: changeSummary },
      });

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['compilation-versions', variables.compilationReport.id] 
      });
      toast.success('Version saved successfully');
    },
    onError: (error) => {
      console.error('Error creating version:', error);
      toast.error('Failed to save version');
    },
  });
}

// Lock a version
export function useLockCompilationVersion() {
  const queryClient = useQueryClient();
  const createAudit = useCreateAuditEntry();

  return useMutation({
    mutationFn: async ({ versionId, compilationReportId }: { versionId: string; compilationReportId: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('compilation_report_versions')
        .update({
          is_locked: true,
          locked_at: new Date().toISOString(),
          locked_by: userData?.user?.id || null,
        })
        .eq('id', versionId)
        .select()
        .single();

      if (error) throw error;
      
      // Create audit entry
      await createAudit.mutateAsync({
        compilation_report_id: compilationReportId,
        action: 'version_locked',
        action_details: { version_id: versionId },
      });

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: ['compilation-versions', data.compilation_report_id] 
      });
      toast.success('Version locked successfully');
    },
    onError: (error) => {
      console.error('Error locking version:', error);
      toast.error('Failed to lock version');
    },
  });
}

// Restore a version
export function useRestoreCompilationVersion() {
  const queryClient = useQueryClient();
  const createAudit = useCreateAuditEntry();

  return useMutation({
    mutationFn: async ({ version, compilationReportId }: { version: CompilationVersion; compilationReportId: string }) => {
      const snapshotData = version.snapshot_data as unknown as CompilationReport;
      
      // Update the compilation report with the snapshot data
      const { error } = await supabase
        .from('compilation_reports')
        .update({
          prepared_by: snapshotData.prepared_by,
          selected_note_templates: snapshotData.selected_note_templates,
          custom_notes: snapshotData.custom_notes,
          firm_name: snapshotData.firm_name,
          firm_address: snapshotData.firm_address,
          preparer_license_number: snapshotData.preparer_license_number,
          statement_types: snapshotData.statement_types,
          notes: snapshotData.notes,
        })
        .eq('id', compilationReportId);

      if (error) throw error;
      
      // Create audit entry
      await createAudit.mutateAsync({
        compilation_report_id: compilationReportId,
        action: 'version_restored',
        action_details: { restored_version: version.version_number },
      });

      return true;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['compilation-reports'] });
      queryClient.invalidateQueries({ 
        queryKey: ['compilation-versions', variables.compilationReportId] 
      });
      toast.success(`Restored to version ${variables.version.version_number}`);
    },
    onError: (error) => {
      console.error('Error restoring version:', error);
      toast.error('Failed to restore version');
    },
  });
}

// Helper to format audit action for display
export function formatAuditAction(action: string): string {
  const actionMap: Record<string, string> = {
    'created': 'Report Created',
    'updated': 'Report Updated',
    'issued': 'Report Issued',
    'version_created': 'Version Saved',
    'version_locked': 'Version Locked',
    'version_restored': 'Version Restored',
    'downloaded': 'Report Downloaded',
    'printed': 'Report Printed',
    'exported_word': 'Exported to Word',
    'exported_pdf': 'Exported to PDF',
    'note_added': 'Note Added',
    'note_removed': 'Note Removed',
    'preparer_changed': 'Preparer Changed',
  };
  return actionMap[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
