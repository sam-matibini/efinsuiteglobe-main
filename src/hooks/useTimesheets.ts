import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'processed';
export type TimesheetEntryType = 'daily' | 'weekly' | 'project';
export type ApprovalMethod = 'manager' | 'hr' | 'auto';

export interface Timesheet {
  id: string;
  employee_id: string;
  organization_id: string | null;
  period_start: string;
  period_end: string;
  entry_type: TimesheetEntryType;
  status: TimesheetStatus;
  total_regular_hours: number | null;
  total_overtime_hours: number | null;
  total_hours: number | null;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  approval_method: ApprovalMethod | null;
  rejection_reason: string | null;
  notes: string | null;
  pay_run_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimesheetEntry {
  id: string;
  timesheet_id: string;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  break_duration: number | null;
  regular_hours: number;
  overtime_hours: number | null;
  project_id: string | null;
  task_description: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimesheetWithEmployee extends Timesheet {
  employees?: {
    id: string;
    first_name: string;
    last_name: string;
    employee_number: string;
    department: string | null;
  } | null;
}

export function useTimesheets(employeeId?: string) {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const timesheetsQuery = useQuery({
    queryKey: ['timesheets', organization?.id, employeeId],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      let query = supabase
        .from('employee_timesheets')
        .select(`
          *,
          employees (
            id,
            first_name,
            last_name,
            employee_number,
            department
          )
        `)
        .eq('organization_id', organization.id)
        .order('period_start', { ascending: false });

      if (employeeId) {
        query = query.eq('employee_id', employeeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TimesheetWithEmployee[];
    },
    enabled: !!organization?.id,
  });

  const createTimesheet = useMutation({
    mutationFn: async (input: {
      employee_id: string;
      period_start: string;
      period_end: string;
      entry_type?: TimesheetEntryType;
      notes?: string;
    }) => {
      if (!organization?.id) throw new Error('No organization selected');
      
      const { data, error } = await supabase
        .from('employee_timesheets')
        .insert({
          ...input,
          organization_id: organization.id,
          status: 'draft' as TimesheetStatus,
          entry_type: input.entry_type || 'daily',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Timesheet created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create timesheet: ' + error.message);
    },
  });

  const updateTimesheet = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Timesheet> & { id: string }) => {
      const { error } = await supabase
        .from('employee_timesheets')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Timesheet updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update timesheet: ' + error.message);
    },
  });

  const submitTimesheet = useMutation({
    mutationFn: async (timesheetId: string) => {
      const { error } = await supabase
        .from('employee_timesheets')
        .update({
          status: 'submitted' as TimesheetStatus,
          submitted_at: new Date().toISOString(),
        })
        .eq('id', timesheetId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Timesheet submitted for approval');
    },
    onError: (error) => {
      toast.error('Failed to submit timesheet: ' + error.message);
    },
  });

  const approveTimesheet = useMutation({
    mutationFn: async ({ timesheetId, method }: { timesheetId: string; method: ApprovalMethod }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('employee_timesheets')
        .update({
          status: 'approved' as TimesheetStatus,
          approved_at: new Date().toISOString(),
          approved_by: user.id,
          approval_method: method,
        })
        .eq('id', timesheetId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Timesheet approved');
    },
    onError: (error) => {
      toast.error('Failed to approve timesheet: ' + error.message);
    },
  });

  const rejectTimesheet = useMutation({
    mutationFn: async ({ timesheetId, reason }: { timesheetId: string; reason: string }) => {
      const { error } = await supabase
        .from('employee_timesheets')
        .update({
          status: 'rejected' as TimesheetStatus,
          rejection_reason: reason,
        })
        .eq('id', timesheetId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Timesheet rejected');
    },
    onError: (error) => {
      toast.error('Failed to reject timesheet: ' + error.message);
    },
  });

  const deleteTimesheet = useMutation({
    mutationFn: async (timesheetId: string) => {
      const { error } = await supabase
        .from('employee_timesheets')
        .delete()
        .eq('id', timesheetId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Timesheet deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete timesheet: ' + error.message);
    },
  });

  return {
    timesheets: timesheetsQuery.data ?? [],
    isLoading: timesheetsQuery.isLoading,
    error: timesheetsQuery.error,
    createTimesheet,
    updateTimesheet,
    submitTimesheet,
    approveTimesheet,
    rejectTimesheet,
    deleteTimesheet,
  };
}

export function useTimesheetEntries(timesheetId: string | undefined) {
  const queryClient = useQueryClient();

  const entriesQuery = useQuery({
    queryKey: ['timesheet-entries', timesheetId],
    queryFn: async () => {
      if (!timesheetId) return [];
      
      const { data, error } = await supabase
        .from('timesheet_entries')
        .select('*')
        .eq('timesheet_id', timesheetId)
        .order('work_date');

      if (error) throw error;
      return data as TimesheetEntry[];
    },
    enabled: !!timesheetId,
  });

  const createEntry = useMutation({
    mutationFn: async (input: Omit<TimesheetEntry, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('timesheet_entries')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet-entries', timesheetId] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
    },
    onError: (error) => {
      toast.error('Failed to add entry: ' + error.message);
    },
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TimesheetEntry> & { id: string }) => {
      const { error } = await supabase
        .from('timesheet_entries')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet-entries', timesheetId] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
    },
    onError: (error) => {
      toast.error('Failed to update entry: ' + error.message);
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('timesheet_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet-entries', timesheetId] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Entry deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete entry: ' + error.message);
    },
  });

  return {
    entries: entriesQuery.data ?? [],
    isLoading: entriesQuery.isLoading,
    error: entriesQuery.error,
    createEntry,
    updateEntry,
    deleteEntry,
  };
}
