import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import type { PayRunStatus } from '@/types/payroll';

export interface PayRun {
  id: string;
  organization_id: string | null;
  pay_period_start: string;
  pay_period_end: string;
  pay_date: string;
  status: PayRunStatus;
  total_gross: number | null;
  total_deductions: number | null;
  total_net: number | null;
  total_employer_contributions: number | null;
  employee_count: number | null;
  notes: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayStub {
  id: string;
  pay_run_id: string;
  employee_id: string;
  regular_hours: number | null;
  overtime_hours: number | null;
  vacation_hours: number | null;
  sick_hours: number | null;
  regular_earnings: number | null;
  overtime_earnings: number | null;
  vacation_pay: number | null;
  bonus: number | null;
  commission: number | null;
  other_earnings: number | null;
  gross_pay: number;
  cpp_contribution: number | null;
  ei_premium: number | null;
  federal_tax: number | null;
  provincial_tax: number | null;
  other_deductions: number | null;
  total_deductions: number;
  net_pay: number;
  cpp_employer: number | null;
  ei_employer: number | null;
  ytd_gross: number | null;
  ytd_cpp: number | null;
  ytd_ei: number | null;
  ytd_federal_tax: number | null;
  ytd_provincial_tax: number | null;
  created_at: string;
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    employee_number: string;
    hourly_rate: number | null;
    annual_salary: number | null;
    employment_type: string;
  };
}

export interface CreatePayRunInput {
  pay_period_start: string;
  pay_period_end: string;
  pay_date: string;
  notes?: string;
}

export function usePayRuns(year?: number) {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const currentYear = year || new Date().getFullYear();

  const { data: payRuns = [], isLoading, error } = useQuery({
    queryKey: ['pay-runs', organization?.id, currentYear],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const startOfYear = `${currentYear}-01-01`;
      const endOfYear = `${currentYear}-12-31`;
      
      const { data, error } = await supabase
        .from('pay_runs')
        .select('*')
        .eq('organization_id', organization.id)
        .gte('pay_period_start', startOfYear)
        .lte('pay_period_start', endOfYear)
        .order('pay_period_start', { ascending: false });

      if (error) throw error;
      return data as PayRun[];
    },
    enabled: !!organization?.id,
  });

  const createPayRun = useMutation({
    mutationFn: async (input: CreatePayRunInput) => {
      if (!organization?.id) throw new Error('No organization selected');
      
      const { data, error } = await supabase
        .from('pay_runs')
        .insert([{
          organization_id: organization.id,
          pay_period_start: input.pay_period_start,
          pay_period_end: input.pay_period_end,
          pay_date: input.pay_date,
          notes: input.notes || null,
          status: 'draft' as PayRunStatus,
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay-runs'] });
      toast.success('Pay run created');
    },
    onError: (error) => {
      toast.error('Failed to create pay run: ' + error.message);
    },
  });

  const updatePayRunStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PayRunStatus }) => {
      const updates: Partial<PayRun> = { status };
      
      if (status === 'approved') {
        updates.approved_at = new Date().toISOString();
      }
      
      const { data, error } = await supabase
        .from('pay_runs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay-runs'] });
      toast.success('Pay run status updated');
    },
    onError: (error) => {
      toast.error('Failed to update pay run: ' + error.message);
    },
  });

  const deletePayRun = useMutation({
    mutationFn: async (id: string) => {
      // First delete associated pay stubs
      await supabase.from('pay_stubs').delete().eq('pay_run_id', id);
      
      // Then delete the pay run
      const { error } = await supabase.from('pay_runs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay-runs'] });
      toast.success('Pay run deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete pay run: ' + error.message);
    },
  });

  // YTD calculations
  const paidRuns = payRuns.filter(p => p.status === 'paid');
  const ytdGross = paidRuns.reduce((s, p) => s + (p.total_gross || 0), 0);
  const ytdDeductions = paidRuns.reduce((s, p) => s + (p.total_deductions || 0), 0);
  const ytdNet = paidRuns.reduce((s, p) => s + (p.total_net || 0), 0);

  return {
    payRuns,
    isLoading,
    error,
    ytdGross,
    ytdDeductions,
    ytdNet,
    paidRunsCount: paidRuns.length,
    createPayRun,
    updatePayRunStatus,
    deletePayRun,
  };
}

export function usePayStubs(payRunId?: string) {
  const { data: payStubs = [], isLoading, error } = useQuery({
    queryKey: ['pay-stubs', payRunId],
    queryFn: async () => {
      if (!payRunId) return [];
      
      const { data, error } = await supabase
        .from('pay_stubs')
        .select(`
          *,
          employee:employees(id, first_name, last_name, employee_number, hourly_rate, annual_salary, employment_type)
        `)
        .eq('pay_run_id', payRunId)
        .order('created_at');

      if (error) throw error;
      return data as PayStub[];
    },
    enabled: !!payRunId,
  });

  return { payStubs, isLoading, error };
}
